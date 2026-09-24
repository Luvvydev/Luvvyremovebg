import { pipeline, env } from '@huggingface/transformers';
import { removeBackground } from '@imgly/background-removal';
import { runBria } from './bria-engine.js';

env.allowRemoteModels = true;
env.allowLocalModels = false;
if ('useBrowserCache' in env) env.useBrowserCache = true;

const ANIME_MODEL = 'BritishWerewolf/IS-Net-Anime';
let animePromise = null;

export async function runSmart(file, image, mode, onProgress = () => {}) {
  const analysis = analyze(image);
  const requested = mode || 'smart';
  if (requested !== 'smart') return runOne(requested, file, image, analysis, onProgress);

  const plan = analysis.flat > 0.58
    ? ['flat', analysis.anime > 0.47 ? 'anime' : 'general']
    : analysis.anime > 0.47
      ? ['anime', 'flat', 'general']
      : ['general', 'flat', 'fast'];

  const candidates = [];
  for (let i = 0; i < plan.length; i++) {
    const engine = plan[i];
    try {
      const result = await runOne(engine, file, image, analysis, (p, label) => {
        const base = 6 + i * (86 / plan.length);
        onProgress(Math.min(96, Math.round(base + (86 / plan.length) * (p / 100))), label);
      });
      result.score = score(result.alpha, result.width, result.height, analysis, engine);
      candidates.push(result);
    } catch (error) {
      console.warn(`Smart engine skipped ${engine}`, error);
    }
  }
  if (!candidates.length) throw new Error('No local cutout engine could run.');
  candidates.sort((a, b) => b.score - a.score);
  const best = candidates[0];
  best.alpha = cleanup(best.alpha, best.width, best.height);
  best.summary = `${analysis.kind} image. Smart tested ${candidates.map((c) => label(c.engine)).join(', ')} and chose ${label(best.engine)}.`;
  onProgress(100, `Smart chose ${label(best.engine)}.`);
  return best;
}

async function runOne(engine, file, image, analysis, onProgress) {
  if (engine === 'flat') {
    onProgress(20, 'Running edge-aware background solver…');
    const alpha = flatCutout(image, analysis);
    onProgress(100, 'Building editable cutout…');
    return { engine, alpha, width: image.naturalWidth, height: image.naturalHeight, summary: 'Edge-aware flat background solver.' };
  }
  if (engine === 'anime') {
    onProgress(5, 'Preparing anime model…');
    if (!animePromise) {
      animePromise = pipeline('background-removal', ANIME_MODEL, {
        device: 'wasm',
        dtype: 'fp32',
        progress_callback: (info) => {
          if (typeof info?.progress === 'number') onProgress(Math.min(78, Math.round(info.progress <= 1 ? info.progress * 78 : info.progress * 0.78)), 'Downloading anime model…');
        },
      }).catch((error) => { animePromise = null; throw error; });
    }
    const remover = await animePromise;
    onProgress(84, 'Running anime cutout…');
    const output = await remover(file);
    return fromRaw(output, image, engine, 'IS-Net Anime cutout.');
  }
  if (engine === 'general') {
    const output = await runBria(file, onProgress);
    return fromRaw(output, image, engine, 'BRIA RMBG 2.0 cutout.');
  }
  if (engine === 'fast') {
    const blob = await removeBackground(file, {
      model: 'isnet_fp16',
      device: navigator.gpu ? 'gpu' : 'cpu',
      output: { format: 'image/png', quality: 1, type: 'foreground' },
      progress: (_key, current, total) => total && onProgress(Math.min(90, Math.round(current / total * 90)), 'Running fast cutout…'),
    });
    const alpha = await blobAlpha(blob, image.naturalWidth, image.naturalHeight);
    return { engine, alpha, width: image.naturalWidth, height: image.naturalHeight, summary: 'IMG.LY fast cutout.' };
  }
  throw new Error(`Unknown engine: ${engine}`);
}

function fromRaw(raw, image, engine, summary) {
  const source = Array.isArray(raw) ? raw[0] : raw;
  if (!source?.data || !source.width || !source.height) throw new Error(`${label(engine)} returned no image.`);
  const channels = source.channels || Math.round(source.data.length / (source.width * source.height));
  const alpha = new Uint8ClampedArray(source.width * source.height);
  if (channels === 4) {
    for (let i = 0, p = 3; i < alpha.length; i++, p += 4) alpha[i] = source.data[p];
  } else if (channels === 1) {
    alpha.set(source.data);
  } else {
    throw new Error(`${label(engine)} returned no alpha mask.`);
  }
  return {
    engine,
    alpha: source.width === image.naturalWidth && source.height === image.naturalHeight ? alpha : resizeMask(alpha, source.width, source.height, image.naturalWidth, image.naturalHeight),
    width: image.naturalWidth,
    height: image.naturalHeight,
    summary,
  };
}

function analyze(image) {
  const { width, height, data } = pixels(image, 256);
  let borderR = 0, borderG = 0, borderB = 0, borderN = 0, localFlat = 0, pairs = 0, sat = 0, darkEdges = 0;
  const lum = new Float32Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x, p = i * 4, r = data[p], g = data[p + 1], b = data[p + 2];
      lum[i] = .299 * r + .587 * g + .114 * b;
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
      sat += mx ? (mx - mn) / mx : 0;
      if (x === 0 || y === 0 || x === width - 1 || y === height - 1) { borderR += r; borderG += g; borderB += b; borderN++; }
      if (x + 1 < width) { pairs++; if (dist(r,g,b,data[p+4],data[p+5],data[p+6]) < 22) localFlat++; }
      if (y + 1 < height) { const q=p+width*4; pairs++; if (dist(r,g,b,data[q],data[q+1],data[q+2]) < 22) localFlat++; }
    }
  }
  const br = borderR / borderN, bg = borderG / borderN, bb = borderB / borderN;
  let dev = 0;
  for (let y = 0; y < height; y++) for (let x of [0, width - 1]) { const p=(y*width+x)*4; dev += dist(data[p],data[p+1],data[p+2],br,bg,bb); }
  for (let x = 1; x < width - 1; x++) for (let y of [0, height - 1]) { const p=(y*width+x)*4; dev += dist(data[p],data[p+1],data[p+2],br,bg,bb); }
  dev /= borderN;
  for (let y = 1; y < height - 1; y++) for (let x = 1; x < width - 1; x++) {
    const i=y*width+x, gx=Math.abs(lum[i+1]-lum[i-1]), gy=Math.abs(lum[i+width]-lum[i-width]);
    if (gx + gy > 56 && lum[i] < 150) darkEdges++;
  }
  const flat = Math.max(0, Math.min(1, (1 - Math.min(1, dev / 70)) * .58 + (localFlat / Math.max(1,pairs)) * .42));
  const anime = Math.max(0, Math.min(1, (localFlat / Math.max(1,pairs)) * .42 + Math.min(1, darkEdges / (width*height) * 7) * .35 + Math.min(1, sat/(width*height) * 1.8) * .23));
  return { flat, anime, kind: anime > .47 ? 'Artwork/anime-like' : flat > .55 ? 'Simple-background photo' : 'General photo' };
}

function flatCutout(image, analysis) {
  const sample = pixels(image, 900), { width, height, data } = sample, total=width*height;
  let br=0,bg=0,bb=0,n=0;
  borderEach(width,height,(i)=>{const p=i*4;br+=data[p];bg+=data[p+1];bb+=data[p+2];n++;});
  br/=n; bg/=n; bb/=n;
  const threshold = 28 + (1-analysis.flat)*28;
  const seen = new Uint8Array(total), queue = new Int32Array(total); let head=0,tail=0;
  const push=(i)=>{if(seen[i])return;const p=i*4;if(dist(data[p],data[p+1],data[p+2],br,bg,bb)<=threshold){seen[i]=1;queue[tail++]=i;}};
  borderEach(width,height,push);
  while(head<tail){const i=queue[head++],x=i%width,y=(i/width)|0,p=i*4;for(const j of [x?i-1:-1,x<width-1?i+1:-1,y?i-width:-1,y<height-1?i+width:-1]){if(j<0||seen[j])continue;const q=j*4;if(dist(data[q],data[q+1],data[q+2],br,bg,bb)<=threshold && dist(data[q],data[q+1],data[q+2],data[p],data[p+1],data[p+2])<=threshold*.95){seen[j]=1;queue[tail++]=j;}}}
  const alpha=new Uint8ClampedArray(total);for(let i=0;i<total;i++)alpha[i]=seen[i]?0:255;
  return width===image.naturalWidth&&height===image.naturalHeight?alpha:resizeMask(alpha,width,height,image.naturalWidth,image.naturalHeight);
}

function score(alpha,w,h,analysis,engine){let fg=0,border=0;for(let y=0;y<h;y++)for(let x=0;x<w;x++){const a=alpha[y*w+x]/255;fg+=a;if(x===0||y===0||x===w-1||y===h-1)border+=a;}const area=fg/(w*h),borderClean=1-border/Math.max(1,2*w+2*h-4);let s=borderClean*.55+(area>.02&&area<.94?1-Math.abs(area-.42)/.58:0)*.45;if(engine==='anime'&&analysis.anime>.47)s+=.16;if(engine==='flat'&&analysis.flat>.58)s+=.14;if(engine==='fast')s-=.05;return s;}

function cleanup(alpha,w,h){const out=new Uint8ClampedArray(alpha);for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){const i=y*w+x,a=alpha[i];let lo=0,hi=0,sum=0;for(let yy=-1;yy<=1;yy++)for(let xx=-1;xx<=1;xx++){const v=alpha[(y+yy)*w+x+xx];sum+=v;if(v<64)lo++;if(v>191)hi++;}if(lo&&hi)out[i]=Math.round(sum/9);else if(a<8)out[i]=0;else if(a>247)out[i]=255;}return out;}

async function blobAlpha(blob,w,h){const url=URL.createObjectURL(blob);try{const image=await imageFrom(url),c=document.createElement('canvas');c.width=w;c.height=h;const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0,w,h);const d=ctx.getImageData(0,0,w,h).data,a=new Uint8ClampedArray(w*h);for(let i=0,p=3;i<a.length;i++,p+=4)a[i]=d[p];return a;}finally{URL.revokeObjectURL(url);}}
function imageFrom(src){return new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=reject;i.src=src;});}
function pixels(image,max){const sw=image.naturalWidth,sh=image.naturalHeight,s=Math.min(1,max/Math.max(sw,sh)),w=Math.max(1,Math.round(sw*s)),h=Math.max(1,Math.round(sh*s)),c=document.createElement('canvas');c.width=w;c.height=h;const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0,w,h);return{width:w,height:h,data:ctx.getImageData(0,0,w,h).data};}
function resizeMask(src,sw,sh,dw,dh){const out=new Uint8ClampedArray(dw*dh);for(let y=0;y<dh;y++){const sy=Math.min(sh-1,Math.floor(y*sh/dh));for(let x=0;x<dw;x++){const sx=Math.min(sw-1,Math.floor(x*sw/dw));out[y*dw+x]=src[sy*sw+sx];}}return out;}
function borderEach(w,h,fn){for(let x=0;x<w;x++){fn(x);fn((h-1)*w+x);}for(let y=1;y<h-1;y++){fn(y*w);fn(y*w+w-1);}}
function dist(r1,g1,b1,r2,g2,b2){return Math.hypot(r1-r2,g1-g2,b1-b2);}
function label(engine){return({general:'BRIA RMBG 2.0',anime:'IS-Net Anime',flat:'edge-aware solver',fast:'IMG.LY fast'}[engine]||engine);}
