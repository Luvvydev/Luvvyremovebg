import { removeBackground } from '@imgly/background-removal';
import { removeBackgroundQuality } from './quality-engine.js';
import './styles.css';

const FAST_MODEL_NAME = 'isnet_fp16';

const app = document.querySelector('#app');

const state = {
  theme: localStorage.getItem('luvvy-theme') || 'light',
  engine: localStorage.getItem('luvvy-engine') || 'quality',
  file: null,
  originalImage: null,
  originalObjectUrl: null,
  width: 0,
  height: 0,
  originalAlpha: null,
  currentAlpha: null,
  maskImageData: null,
  maskCanvas: document.createElement('canvas'),
  maskCtx: null,
  activeTab: 'cutout',
  tool: 'erase',
  brushSize: 52,
  brushHardness: 0.82,
  feather: 0,
  zoom: 1,
  panX: 0,
  panY: 0,
  imageRect: null,
  isDrawing: false,
  isPanning: false,
  lastPoint: null,
  panStart: null,
  strokeBefore: null,
  undoStack: [],
  redoStack: [],
  background: { type: 'transparent', color: '#ffffff', image: null, imageUrl: null },
  blurBackground: 0,
  shadow: { enabled: false, blur: 24, opacity: 0.34, offsetX: 12, offsetY: 20 },
  adjust: { brightness: 100, contrast: 100, saturation: 100 },
  design: { scale: 100, offsetX: 0, offsetY: 0 },
  processing: false,
  processingWarning: '',
  progress: 0,
  progressLabel: '',
  canvas: null,
  ctx: null,
  resizeObserver: null,
  spaceDown: false,
};

function setTheme(theme) {
  state.theme = theme;
  document.documentElement.dataset.theme = theme;
  localStorage.setItem('luvvy-theme', theme);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = theme === 'dark' ? '#111318' : '#ffffff';
  document.querySelectorAll('[data-theme-label]').forEach((el) => {
    el.textContent = theme === 'dark' ? 'Light mode' : 'Dark mode';
  });
}

function setEngine(engine) {
  state.engine = engine === 'fast' ? 'fast' : 'quality';
  localStorage.setItem('luvvy-engine', state.engine);
}

function engineLabel(engine = state.engine) {
  return engine === 'quality' ? 'Quality · BRIA RMBG 2.0' : 'Fast · IMG.LY IS-Net';
}

function icon(name) {
  const icons = {
    moon: '<path d="M21 12.8A8.5 8.5 0 1 1 11.2 3 6.7 6.7 0 0 0 21 12.8Z"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>',
    upload: '<path d="M12 16V4M7 9l5-5 5 5M5 20h14"/>',
    sparkles: '<path d="m12 3 1.2 3.2L16 7.5l-2.8 1.3L12 12l-1.2-3.2L8 7.5l2.8-1.3L12 3ZM5 13l.8 2.2L8 16l-2.2.8L5 19l-.8-2.2L2 16l2.2-.8L5 13ZM18 14l.9 2.4L21 17.3l-2.1.9L18 21l-.9-2.8-2.1-.9 2.1-.9L18 14Z"/>',
    chevron: '<path d="m8 10 4 4 4-4"/>',
    undo: '<path d="M9 7H4v-5M4 7c2.1-2.3 5-3.5 8-3.1A8 8 0 1 1 5.2 16"/>',
    redo: '<path d="M15 7h5v-5M20 7c-2.1-2.3-5-3.5-8-3.1A8 8 0 1 0 18.8 16"/>',
    close: '<path d="m6 6 12 12M18 6 6 18"/>',
    download: '<path d="M12 3v12M7 10l5 5 5-5M5 21h14"/>',
    image: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 15-5-5L5 19"/>',
    brush: '<path d="m14 4 6 6-8.5 8.5a4 4 0 0 1-5.7 0 4 4 0 0 1 0-5.7L14 4Z"/><path d="M5.5 18.8c-.5 1.8-1.7 2.7-3.5 2.7 1.8-1.1 1.4-2.5 2.2-3.5"/>',
  };
  return `<svg viewBox="0 0 24 24" aria-hidden="true">${icons[name] || ''}</svg>`;
}

function renderLanding() {
  app.innerHTML = `
    <main class="landing-shell">
      <header class="site-header">
        <button class="brand" type="button" aria-label="Luvvy removebg home">
          <img src="./logo.svg" alt="" />
          <span class="brand-name">Luvvy <strong>removebg</strong></span>
        </button>
        <nav class="header-actions">
          <button class="text-button" id="privacyBtn">Privacy</button>
          <button class="theme-button" id="themeBtn" aria-label="Toggle theme">
            ${icon(state.theme === 'dark' ? 'sun' : 'moon')}
            <span data-theme-label>${state.theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>
          </button>
        </nav>
      </header>

      <section class="hero">
        <div class="hero-copy">
          <div class="hero-title-row">
            <h1>Remove Image<br />Background</h1>
            <span class="local-badge">100% LOCAL</span>
          </div>
          <p>Automatically remove backgrounds in seconds</p>
        </div>

        <div class="upload-stage" id="dropZone">
          <input id="fileInput" type="file" accept="image/png,image/jpeg,image/webp" hidden />
          <div class="upload-pill">
            <button class="primary-upload" id="uploadBtn">${icon('upload')} Upload Image</button>
            <div class="upload-copy">
              <strong>or drop a file</strong>
              <span>or paste an image</span>
            </div>
          </div>
          <label class="select-row landing-select-row">
            <div>
              <span>Automatic cutout engine</span>
              <small>Quality is the default. First run downloads about 366 MB, then the browser cache is reused.</small>
            </div>
            <select id="landingEngine">
              <option value="quality" ${state.engine === 'quality' ? 'selected' : ''}>Quality · BRIA RMBG 2.0</option>
              <option value="fast" ${state.engine === 'fast' ? 'selected' : ''}>Fast · IMG.LY IS-Net</option>
            </select>
          </label>
          <p class="upload-note">PNG, JPG or WebP. Your image never leaves this device.</p>
        </div>
      </section>

      <div class="orb orb-one"></div>
      <div class="orb orb-two"></div>
      <div class="orb orb-three"></div>

      <footer class="landing-footer">
        <span>Private browser processing</span>
        <button class="link-button" id="licenseBtn">Open source licenses</button>
      </footer>
    </main>
    ${legalModalMarkup()}
  `;
  bindLanding();
}

function legalModalMarkup() {
  return `
    <div class="modal-backdrop hidden" id="legalModal" role="dialog" aria-modal="true" aria-labelledby="legalTitle">
      <div class="modal-card legal-card">
        <div class="modal-heading">
          <div><span class="eyebrow">Luvvy removebg</span><h2 id="legalTitle">Privacy & licenses</h2></div>
          <button class="icon-button" data-close-modal aria-label="Close">${icon('close')}</button>
        </div>
        <p>Images are processed in your browser. This site does not upload your image to a Luvvy removebg server.</p>
        <p><strong>Quality mode</strong> uses BRIA RMBG 2.0 Web under a non-commercial license, which matches this personal-use project. <strong>Fast mode</strong> uses <code>@imgly/background-removal</code>, distributed under the GNU AGPL v3.</p>
        <p class="muted">See the repository LICENSE and THIRD_PARTY_NOTICES files for complete license information.</p>
      </div>
    </div>`;
}

function bindLanding() {
  const input = document.querySelector('#fileInput');
  const zone = document.querySelector('#dropZone');
  document.querySelector('#uploadBtn').addEventListener('click', () => input.click());
  input.addEventListener('change', () => input.files?.[0] && beginFile(input.files[0]));

  ['dragenter', 'dragover'].forEach((event) => zone.addEventListener(event, (e) => {
    e.preventDefault();
    zone.classList.add('dragging');
  }));
  ['dragleave', 'drop'].forEach((event) => zone.addEventListener(event, (e) => {
    e.preventDefault();
    zone.classList.remove('dragging');
  }));
  zone.addEventListener('drop', (e) => {
    const file = [...e.dataTransfer.files].find((f) => f.type.startsWith('image/'));
    if (file) beginFile(file);
  });

  window.onpaste = (e) => {
    const file = [...(e.clipboardData?.files || [])].find((f) => f.type.startsWith('image/'));
    if (file) beginFile(file);
  };

  document.querySelector('#themeBtn').addEventListener('click', () => {
    setTheme(state.theme === 'dark' ? 'light' : 'dark');
    renderLanding();
  });
  document.querySelector('#landingEngine').addEventListener('change', (e) => setEngine(e.target.value));
  const legal = document.querySelector('#legalModal');
  const openLegal = () => legal.classList.remove('hidden');
  document.querySelector('#privacyBtn').addEventListener('click', openLegal);
  document.querySelector('#licenseBtn').addEventListener('click', openLegal);
  legal.addEventListener('click', (e) => {
    if (e.target === legal || e.target.closest('[data-close-modal]')) legal.classList.add('hidden');
  });
}

async function beginFile(file) {
  if (!file.type.startsWith('image/')) return;
  state.file = file;
  state.processing = true;
  state.processingWarning = '';
  renderProcessing();
  try {
    if (state.originalObjectUrl) URL.revokeObjectURL(state.originalObjectUrl);
    state.originalObjectUrl = URL.createObjectURL(file);
    state.originalImage = await loadImage(state.originalObjectUrl);
    state.width = state.originalImage.naturalWidth;
    state.height = state.originalImage.naturalHeight;
    await runRemoval(file);
    buildMaskState();
    state.feather = 0;
    state.processing = false;
    state.activeTab = 'cutout';
    state.undoStack = [];
    state.redoStack = [];
    state.zoom = 1;
    state.panX = 0;
    state.panY = 0;
    renderEditor();
    if (state.processingWarning) showToast(state.processingWarning, 'error');
  } catch (error) {
    console.error(error);
    state.processing = false;
    renderLanding();
    showToast(`Background removal failed: ${error?.message || 'Unknown error'}`, 'error');
  }
}

function renderProcessing() {
  app.innerHTML = `
    <main class="processing-page">
      <header class="site-header editor-header-lite">
        <button class="brand" type="button"><img src="./logo.svg" alt="" /><span class="brand-name">Luvvy <strong>removebg</strong></span></button>
        <button class="theme-button" id="themeBtn">${icon(state.theme === 'dark' ? 'sun' : 'moon')}<span data-theme-label>${state.theme === 'dark' ? 'Light mode' : 'Dark mode'}</span></button>
      </header>
      <section class="processing-card">
        <div class="spinner"></div>
        <h1>Cutting out your image</h1>
        <p id="progressLabel">Preparing ${engineLabel().toLowerCase()}…</p>
        <div class="progress-track"><div id="progressBar" class="progress-bar"></div></div>
        <span class="processing-note">${state.engine === 'quality' ? 'Quality mode downloads about 366 MB once, then the browser cache is reused. Processing stays on this device.' : 'Fast mode uses a smaller local model and usually starts quicker.'}</span>
      </section>
    </main>`;
  document.querySelector('#themeBtn').addEventListener('click', () => setTheme(state.theme === 'dark' ? 'light' : 'dark'));
}

async function runRemoval(file) {
  if (state.engine === 'quality') {
    try {
      await runQualityRemoval(file);
    } catch (error) {
      console.warn('Quality cutout failed, falling back to fast mode.', error);
      updateProgress(18, 'Quality model unavailable, using fast fallback…');
      await runFastRemoval(file);
      state.processingWarning = 'Quality mode could not run in this browser, so the fast fallback was used.';
    }
  } else {
    await runFastRemoval(file);
  }
}

async function runQualityRemoval(file) {
  const blob = await removeBackgroundQuality(file, updateProgress);
  const objectUrl = URL.createObjectURL(blob);
  try {
    const cutoutImage = await loadImage(objectUrl);
    state.originalAlpha = extractAlphaFromCutoutImage(cutoutImage, state.width, state.height);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function runFastRemoval(file) {
  let lastPercent = 0;
  const config = {
    model: FAST_MODEL_NAME,
    device: navigator.gpu ? 'gpu' : 'cpu',
    output: { format: 'image/png', quality: 1, type: 'foreground' },
    progress: (key, current, total) => {
      if (!total) return;
      const percent = Math.min(92, Math.round((current / total) * 92));
      lastPercent = Math.max(lastPercent, percent);
      updateProgress(lastPercent, key.includes('model') ? 'Loading fast cutout model…' : 'Loading local processor…');
    },
  };

  let blob;
  try {
    blob = await removeBackground(file, config);
  } catch (gpuError) {
    if (config.device === 'gpu') {
      updateProgress(Math.max(lastPercent, 35), 'GPU unavailable, switching to compatible mode…');
      blob = await removeBackground(file, { ...config, device: 'cpu' });
    } else {
      throw gpuError;
    }
  }

  const objectUrl = URL.createObjectURL(blob);
  try {
    const cutoutImage = await loadImage(objectUrl);
    state.originalAlpha = extractAlphaFromCutoutImage(cutoutImage, state.width, state.height);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
  updateProgress(100, 'Building editable cutout…');
}

function extractAlphaFromCutoutImage(image, width, height) {
  const extraction = document.createElement('canvas');
  extraction.width = width;
  extraction.height = height;
  const ctx = extraction.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(image, 0, 0, width, height);
  const data = ctx.getImageData(0, 0, width, height).data;
  const alpha = new Uint8ClampedArray(width * height);
  for (let i = 0, p = 3; i < alpha.length; i++, p += 4) alpha[i] = data[p];
  return alpha;
}

function updateProgress(percent, label) {
  state.progress = percent;
  state.progressLabel = label;
  const bar = document.querySelector('#progressBar');
  const text = document.querySelector('#progressLabel');
  if (bar) bar.style.width = `${percent}%`;
  if (text) text.textContent = label;
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

function buildMaskState() {
  if (!(state.originalAlpha instanceof Uint8ClampedArray)) throw new Error('No alpha mask available to edit.');
  state.originalAlpha = new Uint8ClampedArray(state.originalAlpha);
  state.currentAlpha = new Uint8ClampedArray(state.originalAlpha);

  state.maskCanvas.width = state.width;
  state.maskCanvas.height = state.height;
  state.maskCtx = state.maskCanvas.getContext('2d', { willReadFrequently: true });
  state.maskImageData = state.maskCtx.createImageData(state.width, state.height);
  for (let i = 0, p = 0; i < state.currentAlpha.length; i++, p += 4) {
    state.maskImageData.data[p] = 255;
    state.maskImageData.data[p + 1] = 255;
    state.maskImageData.data[p + 2] = 255;
    state.maskImageData.data[p + 3] = state.currentAlpha[i];
  }
  state.maskCtx.putImageData(state.maskImageData, 0, 0);
}

function renderEditor() {
  window.onpaste = null;
  app.innerHTML = `
    <main class="editor-shell">
      <header class="site-header editor-site-header">
        <button class="brand" id="homeBtn" type="button"><img src="./logo.svg" alt="" /><span class="brand-name">Luvvy <strong>removebg</strong></span></button>
        <div class="file-chip"><span>${escapeHtml(state.file?.name || 'Image')}</span><small>${state.width} × ${state.height}</small></div>
        <div class="header-actions">
          <button class="theme-button compact" id="themeBtn" aria-label="Toggle theme">${icon(state.theme === 'dark' ? 'sun' : 'moon')}</button>
          <button class="secondary-button" id="newImageBtn">New image</button>
        </div>
      </header>

      <section class="editor-toolbar">
        <div class="toolbar-tabs">
          ${toolbarTab('cutout', 'Cutout', 'brush')}
          ${toolbarTab('background', 'Background', 'image')}
          ${toolbarTab('effects', 'Effects', 'sparkles')}
          ${toolbarTab('adjust', 'Adjust', 'sun')}
          ${toolbarTab('design', 'Design', 'image')}
        </div>
        <div class="toolbar-actions">
          <button class="icon-button" id="undoBtn" title="Undo" ${state.undoStack.length ? '' : 'disabled'}>${icon('undo')}</button>
          <button class="icon-button" id="redoBtn" title="Redo" ${state.redoStack.length ? '' : 'disabled'}>${icon('redo')}</button>
          <button class="download-button" id="downloadBtn">${icon('download')} Download ${icon('chevron')}</button>
        </div>
      </section>

      <section class="editor-workspace">
        <aside class="side-panel" id="sidePanel">${panelMarkup()}</aside>
        <div class="canvas-stage" id="canvasStage">
          <canvas id="editorCanvas"></canvas>
          <div class="zoom-controls">
            <button class="icon-button" id="zoomOut" aria-label="Zoom out">−</button>
            <button class="zoom-readout" id="zoomReset">100%</button>
            <button class="icon-button" id="zoomIn" aria-label="Zoom in">+</button>
            <button class="fit-button" id="fitBtn">Fit</button>
          </div>
        </div>
      </section>
    </main>
    ${downloadModalMarkup()}
    ${legalModalMarkup()}
    <div id="toastHost" class="toast-host"></div>
  `;

  state.canvas = document.querySelector('#editorCanvas');
  state.ctx = state.canvas.getContext('2d');
  bindEditor();
  resizeCanvas();
  requestAnimationFrame(renderCanvas);
}

function toolbarTab(id, label, iconName) {
  return `<button class="toolbar-tab ${state.activeTab === id ? 'active' : ''}" data-tab="${id}">${icon(iconName)}<span>${label}</span></button>`;
}

function panelMarkup() {
  if (state.activeTab === 'cutout') {
    return `
      <div class="panel-section">
        <span class="panel-kicker">Cutout</span>
        <h2>Refine edges</h2>
        <p>Paint only where the automatic cutout needs correction.</p>
      </div>
      <label class="select-row compact-select-row">
        <div>
          <span>Automatic engine</span>
          <small>Quality is the default. Its first run downloads about 366 MB, then the browser cache is reused.</small>
        </div>
        <select id="engineMode">
          <option value="quality" ${state.engine === 'quality' ? 'selected' : ''}>Quality · BRIA RMBG 2.0</option>
          <option value="fast" ${state.engine === 'fast' ? 'selected' : ''}>Fast · IMG.LY IS-Net</option>
        </select>
      </label>
      <div class="segmented-control">
        <button class="${state.tool === 'erase' ? 'active' : ''}" data-tool="erase">Erase</button>
        <button class="${state.tool === 'restore' ? 'active' : ''}" data-tool="restore">Restore</button>
      </div>
      ${rangeControl('Brush size', 'brushSize', state.brushSize, 8, 220, 1, `${state.brushSize}px`)}
      ${rangeControl('Hardness', 'brushHardness', Math.round(state.brushHardness * 100), 5, 100, 1, `${Math.round(state.brushHardness * 100)}%`)}
      ${rangeControl('Edge feather', 'feather', state.feather, 0, 18, 1, `${state.feather}px`)}
      <div class="panel-grid two">
        <button class="secondary-button" id="expandMask">Expand 1px</button>
        <button class="secondary-button" id="shrinkMask">Shrink 1px</button>
      </div>
      <button class="secondary-button full" id="resetMask">Reset automatic cutout</button>
      <button class="secondary-button full" id="rerunRemoval">Run automatic cutout again</button>
      <div class="panel-tip"><strong>Tip</strong><span>Hold Space and drag to pan. Mouse wheel zooms.</span></div>`;
  }
  if (state.activeTab === 'background') {
    return `
      <div class="panel-section"><span class="panel-kicker">Background</span><h2>Choose a backdrop</h2><p>Transparency is preserved when you download PNG or WebP.</p></div>
      <div class="background-grid">
        ${backgroundTile('transparent', 'Transparent', 'checker')}
        ${backgroundTile('white', 'White', 'white')}
        ${backgroundTile('black', 'Black', 'black')}
        ${backgroundTile('color', 'Color', 'color')}
      </div>
      <label class="color-row"><span>Custom color</span><input id="bgColor" type="color" value="${state.background.color}" /></label>
      <button class="secondary-button full" id="bgUploadBtn">Upload background image</button>
      <input id="bgUpload" type="file" accept="image/*" hidden />
      ${state.background.image ? '<button class="secondary-button full" id="useBgImage">Use uploaded image</button><button class="text-danger" id="removeBgImage">Remove uploaded image</button>' : ''}
      <div class="panel-tip"><strong>Local</strong><span>Uploaded backgrounds also stay in your browser.</span></div>`;
  }
  if (state.activeTab === 'effects') {
    return `
      <div class="panel-section"><span class="panel-kicker">Effects</span><h2>Depth & focus</h2><p>These effects are rendered into the downloaded image.</p></div>
      ${rangeControl('Background blur', 'blurBackground', state.blurBackground, 0, 30, 1, `${state.blurBackground}px`)}
      <label class="switch-row"><span><strong>Drop shadow</strong><small>Add depth behind the cutout</small></span><input id="shadowEnabled" type="checkbox" ${state.shadow.enabled ? 'checked' : ''} /></label>
      ${rangeControl('Shadow blur', 'shadowBlur', state.shadow.blur, 0, 80, 1, `${state.shadow.blur}px`)}
      ${rangeControl('Shadow opacity', 'shadowOpacity', Math.round(state.shadow.opacity * 100), 0, 100, 1, `${Math.round(state.shadow.opacity * 100)}%`)}
      ${rangeControl('Shadow X', 'shadowX', state.shadow.offsetX, -80, 80, 1, `${state.shadow.offsetX}px`)}
      ${rangeControl('Shadow Y', 'shadowY', state.shadow.offsetY, -80, 80, 1, `${state.shadow.offsetY}px`)}
      <button class="secondary-button full" id="resetEffects">Reset effects</button>`;
  }
  if (state.activeTab === 'adjust') {
    return `
      <div class="panel-section"><span class="panel-kicker">Adjust</span><h2>Tune the subject</h2><p>Simple nondestructive adjustments.</p></div>
      ${rangeControl('Brightness', 'brightness', state.adjust.brightness, 0, 200, 1, `${state.adjust.brightness}%`)}
      ${rangeControl('Contrast', 'contrast', state.adjust.contrast, 0, 200, 1, `${state.adjust.contrast}%`)}
      ${rangeControl('Saturation', 'saturation', state.adjust.saturation, 0, 200, 1, `${state.adjust.saturation}%`)}
      <button class="secondary-button full" id="resetAdjust">Reset adjustments</button>`;
  }
  return `
    <div class="panel-section"><span class="panel-kicker">Design</span><h2>Place the subject</h2><p>Scale or nudge the cutout without changing the original file.</p></div>
    ${rangeControl('Subject scale', 'subjectScale', state.design.scale, 20, 180, 1, `${state.design.scale}%`)}
    ${rangeControl('Horizontal', 'subjectX', state.design.offsetX, -50, 50, 1, `${state.design.offsetX}%`)}
    ${rangeControl('Vertical', 'subjectY', state.design.offsetY, -50, 50, 1, `${state.design.offsetY}%`)}
    <button class="secondary-button full" id="resetDesign">Center & fit</button>
    <div class="panel-tip"><strong>Download</strong><span>Choose original, 1080p, 1440p, 4K or a custom size when exporting.</span></div>`;
}

function rangeControl(label, id, value, min, max, step, display) {
  return `<label class="range-row"><div><span>${label}</span><output data-output="${id}">${display}</output></div><input id="${id}" type="range" min="${min}" max="${max}" step="${step}" value="${value}" /></label>`;
}

function backgroundTile(type, label, swatch) {
  const selected = state.background.type === type || (type === 'color' && state.background.type === 'color');
  return `<button class="background-tile ${selected ? 'active' : ''}" data-background="${type}"><span class="bg-swatch ${swatch}" ${swatch === 'color' ? `style="--swatch:${state.background.color}"` : ''}></span><small>${label}</small></button>`;
}

function bindEditor() {
  document.querySelector('#homeBtn').addEventListener('click', renderLanding);
  document.querySelector('#newImageBtn').addEventListener('click', renderLanding);
  document.querySelector('#themeBtn').addEventListener('click', () => {
    setTheme(state.theme === 'dark' ? 'light' : 'dark');
    renderEditor();
  });
  document.querySelectorAll('[data-tab]').forEach((button) => button.addEventListener('click', () => {
    state.activeTab = button.dataset.tab;
    renderEditor();
  }));
  document.querySelector('#undoBtn').addEventListener('click', undo);
  document.querySelector('#redoBtn').addEventListener('click', redo);
  document.querySelector('#downloadBtn').addEventListener('click', openDownloadModal);
  bindPanel();
  bindCanvasInteractions();

  document.querySelector('#zoomIn').addEventListener('click', () => setZoom(state.zoom * 1.18));
  document.querySelector('#zoomOut').addEventListener('click', () => setZoom(state.zoom / 1.18));
  document.querySelector('#zoomReset').addEventListener('click', () => { state.zoom = 1; state.panX = 0; state.panY = 0; renderCanvas(); updateZoomUI(); });
  document.querySelector('#fitBtn').addEventListener('click', () => { state.zoom = 1; state.panX = 0; state.panY = 0; renderCanvas(); updateZoomUI(); });

  if (state.resizeObserver) state.resizeObserver.disconnect();
  state.resizeObserver = new ResizeObserver(() => resizeCanvas());
  state.resizeObserver.observe(document.querySelector('#canvasStage'));
}

function bindPanel() {
  document.querySelectorAll('[data-tool]').forEach((button) => button.addEventListener('click', () => {
    state.tool = button.dataset.tool;
    document.querySelectorAll('[data-tool]').forEach((b) => b.classList.toggle('active', b === button));
  }));

  document.querySelector('#engineMode')?.addEventListener('change', (e) => {
    setEngine(e.target.value);
    showToast(`Automatic cutout engine set to ${engineLabel()}. Click “Run automatic cutout again” to apply it.`);
  });

  bindRange('brushSize', (v) => state.brushSize = Number(v), (v) => `${v}px`);
  bindRange('brushHardness', (v) => state.brushHardness = Number(v) / 100, (v) => `${v}%`);
  bindRange('feather', (v) => { state.feather = Number(v); renderCanvas(); }, (v) => `${v}px`);
  bindRange('blurBackground', (v) => { state.blurBackground = Number(v); renderCanvas(); }, (v) => `${v}px`);
  bindRange('shadowBlur', (v) => { state.shadow.blur = Number(v); renderCanvas(); }, (v) => `${v}px`);
  bindRange('shadowOpacity', (v) => { state.shadow.opacity = Number(v) / 100; renderCanvas(); }, (v) => `${v}%`);
  bindRange('shadowX', (v) => { state.shadow.offsetX = Number(v); renderCanvas(); }, (v) => `${v}px`);
  bindRange('shadowY', (v) => { state.shadow.offsetY = Number(v); renderCanvas(); }, (v) => `${v}px`);
  bindRange('brightness', (v) => { state.adjust.brightness = Number(v); renderCanvas(); }, (v) => `${v}%`);
  bindRange('contrast', (v) => { state.adjust.contrast = Number(v); renderCanvas(); }, (v) => `${v}%`);
  bindRange('saturation', (v) => { state.adjust.saturation = Number(v); renderCanvas(); }, (v) => `${v}%`);
  bindRange('subjectScale', (v) => { state.design.scale = Number(v); renderCanvas(); }, (v) => `${v}%`);
  bindRange('subjectX', (v) => { state.design.offsetX = Number(v); renderCanvas(); }, (v) => `${v}%`);
  bindRange('subjectY', (v) => { state.design.offsetY = Number(v); renderCanvas(); }, (v) => `${v}%`);

  document.querySelector('#shadowEnabled')?.addEventListener('change', (e) => { state.shadow.enabled = e.target.checked; renderCanvas(); });
  document.querySelector('#resetEffects')?.addEventListener('click', () => { state.blurBackground = 0; state.shadow = { enabled: false, blur: 24, opacity: 0.34, offsetX: 12, offsetY: 20 }; renderEditor(); });
  document.querySelector('#resetAdjust')?.addEventListener('click', () => { state.adjust = { brightness: 100, contrast: 100, saturation: 100 }; renderEditor(); });
  document.querySelector('#resetDesign')?.addEventListener('click', () => { state.design = { scale: 100, offsetX: 0, offsetY: 0 }; renderEditor(); });
  document.querySelector('#resetMask')?.addEventListener('click', resetMask);
  document.querySelector('#expandMask')?.addEventListener('click', () => morphMask('expand'));
  document.querySelector('#shrinkMask')?.addEventListener('click', () => morphMask('shrink'));
  document.querySelector('#rerunRemoval')?.addEventListener('click', () => beginFile(state.file));

  document.querySelectorAll('[data-background]').forEach((button) => button.addEventListener('click', () => {
    const type = button.dataset.background;
    state.background.type = type;
    if (type === 'white') state.background.color = '#ffffff';
    if (type === 'black') state.background.color = '#000000';
    if (type === 'color' && !state.background.color) state.background.color = '#ffffff';
    renderEditor();
  }));

  document.querySelector('#bgColor')?.addEventListener('input', (e) => {
    state.background.color = e.target.value;
    state.background.type = 'color';
    renderCanvas();
    document.querySelector('.bg-swatch.color')?.style.setProperty('--swatch', e.target.value);
  });
  document.querySelector('#bgUploadBtn')?.addEventListener('click', () => document.querySelector('#bgUpload').click());
  document.querySelector('#bgUpload')?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (state.background.imageUrl) URL.revokeObjectURL(state.background.imageUrl);
    state.background.imageUrl = URL.createObjectURL(file);
    state.background.image = await loadImage(state.background.imageUrl);
    state.background.type = 'image';
    renderEditor();
  });
  document.querySelector('#useBgImage')?.addEventListener('click', () => { state.background.type = 'image'; renderCanvas(); });
  document.querySelector('#removeBgImage')?.addEventListener('click', () => {
    if (state.background.imageUrl) URL.revokeObjectURL(state.background.imageUrl);
    state.background.image = null;
    state.background.imageUrl = null;
    state.background.type = 'transparent';
    renderEditor();
  });
}

function bindRange(id, assign, format) {
  const input = document.querySelector(`#${id}`);
  if (!input) return;
  input.addEventListener('input', (e) => {
    assign(e.target.value);
    const output = document.querySelector(`[data-output="${id}"]`);
    if (output) output.textContent = format(e.target.value);
  });
}

function bindCanvasInteractions() {
  const canvas = state.canvas;
  canvas.addEventListener('pointerdown', (e) => {
    canvas.setPointerCapture(e.pointerId);
    if (state.spaceDown || e.button === 1 || state.activeTab !== 'cutout') {
      state.isPanning = true;
      state.panStart = { x: e.clientX, y: e.clientY, panX: state.panX, panY: state.panY };
      canvas.classList.add('panning');
      return;
    }
    const point = canvasToImage(e.clientX, e.clientY);
    if (!point) return;
    state.isDrawing = true;
    state.lastPoint = point;
    state.strokeBefore = new Map();
    applyBrush(point.x, point.y);
    renderCanvas();
  });
  canvas.addEventListener('pointermove', (e) => {
    if (state.isPanning && state.panStart) {
      state.panX = state.panStart.panX + (e.clientX - state.panStart.x);
      state.panY = state.panStart.panY + (e.clientY - state.panStart.y);
      renderCanvas();
      return;
    }
    if (!state.isDrawing) return;
    const point = canvasToImage(e.clientX, e.clientY);
    if (!point || !state.lastPoint) return;
    paintLine(state.lastPoint, point);
    state.lastPoint = point;
    renderCanvas();
  });
  const endPointer = () => {
    if (state.isDrawing) finishStrokeHistory();
    state.isDrawing = false;
    state.isPanning = false;
    state.lastPoint = null;
    state.panStart = null;
    canvas.classList.remove('panning');
  };
  canvas.addEventListener('pointerup', endPointer);
  canvas.addEventListener('pointercancel', endPointer);
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.1 : 0.9;
    setZoom(state.zoom * factor);
  }, { passive: false });

  window.onkeydown = (e) => {
    if (e.code === 'Space' && !isTyping(e.target)) { state.spaceDown = true; e.preventDefault(); }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !isTyping(e.target)) {
      e.preventDefault();
      e.shiftKey ? redo() : undo();
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y' && !isTyping(e.target)) { e.preventDefault(); redo(); }
  };
  window.onkeyup = (e) => { if (e.code === 'Space') state.spaceDown = false; };
}

function isTyping(target) {
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target?.isContentEditable;
}

function paintLine(a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const distance = Math.hypot(dx, dy);
  const radius = sourceBrushRadius();
  const steps = Math.max(1, Math.ceil(distance / Math.max(2, radius * 0.3)));
  for (let i = 1; i <= steps; i++) {
    applyBrush(a.x + (dx * i) / steps, a.y + (dy * i) / steps);
  }
}

function sourceBrushRadius() {
  if (!state.imageRect) return state.brushSize;
  const displayScale = state.imageRect.width / state.width;
  return Math.max(1, state.brushSize / Math.max(displayScale, 0.0001));
}

function applyBrush(cx, cy) {
  const radius = sourceBrushRadius();
  const hard = Math.max(0.05, Math.min(1, state.brushHardness));
  const x0 = Math.max(0, Math.floor(cx - radius));
  const x1 = Math.min(state.width - 1, Math.ceil(cx + radius));
  const y0 = Math.max(0, Math.floor(cy - radius));
  const y1 = Math.min(state.height - 1, Math.ceil(cy + radius));
  const inner = radius * hard;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const d = Math.hypot(x - cx, y - cy);
      if (d > radius) continue;
      const idx = y * state.width + x;
      if (!state.strokeBefore.has(idx)) state.strokeBefore.set(idx, state.currentAlpha[idx]);
      const strength = d <= inner ? 1 : 1 - ((d - inner) / Math.max(1, radius - inner));
      const current = state.currentAlpha[idx];
      if (state.tool === 'erase') {
        state.currentAlpha[idx] = Math.round(current * (1 - strength));
      } else {
        const target = 255;
        state.currentAlpha[idx] = Math.round(current + (target - current) * strength);
      }
      const p = idx * 4 + 3;
      state.maskImageData.data[p] = state.currentAlpha[idx];
    }
  }
  state.maskCtx.putImageData(state.maskImageData, 0, 0, x0, y0, x1 - x0 + 1, y1 - y0 + 1);
}

function finishStrokeHistory() {
  if (!state.strokeBefore?.size) return;
  const count = state.strokeBefore.size;
  const indices = new Uint32Array(count);
  const before = new Uint8Array(count);
  const after = new Uint8Array(count);
  let i = 0;
  for (const [idx, value] of state.strokeBefore.entries()) {
    indices[i] = idx;
    before[i] = value;
    after[i] = state.currentAlpha[idx];
    i++;
  }
  pushHistory({ type: 'patch', indices, before, after });
  state.strokeBefore = null;
}

function pushHistory(command) {
  state.undoStack.push(command);
  if (state.undoStack.length > 30) state.undoStack.shift();
  state.redoStack = [];
  updateHistoryButtons();
}

function updateHistoryButtons() {
  const undoBtn = document.querySelector('#undoBtn');
  const redoBtn = document.querySelector('#redoBtn');
  if (undoBtn) undoBtn.disabled = !state.undoStack.length;
  if (redoBtn) redoBtn.disabled = !state.redoStack.length;
}

function applyHistory(command, direction) {
  const values = direction === 'undo' ? command.before : command.after;
  if (command.type === 'patch') {
    for (let i = 0; i < command.indices.length; i++) {
      const idx = command.indices[i];
      state.currentAlpha[idx] = values[i];
      state.maskImageData.data[idx * 4 + 3] = values[i];
    }
  } else {
    state.currentAlpha.set(values);
    for (let i = 0; i < values.length; i++) state.maskImageData.data[i * 4 + 3] = values[i];
  }
  state.maskCtx.putImageData(state.maskImageData, 0, 0);
  renderCanvas();
}

function undo() {
  const command = state.undoStack.pop();
  if (!command) return;
  applyHistory(command, 'undo');
  state.redoStack.push(command);
  updateHistoryButtons();
}

function redo() {
  const command = state.redoStack.pop();
  if (!command) return;
  applyHistory(command, 'redo');
  state.undoStack.push(command);
  updateHistoryButtons();
}

function resetMask() {
  const before = new Uint8Array(state.currentAlpha);
  const after = new Uint8Array(state.originalAlpha);
  state.currentAlpha.set(after);
  refreshMaskImage();
  pushHistory({ type: 'full', before, after });
  renderCanvas();
}

function morphMask(mode) {
  const before = new Uint8Array(state.currentAlpha);
  const src = state.currentAlpha;
  const w = state.width;
  const h = state.height;
  const horizontal = new Uint8ClampedArray(src.length);
  const result = new Uint8ClampedArray(src.length);
  const useMax = mode === 'expand';
  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) {
      let value = src[row + x];
      if (x > 0) value = useMax ? Math.max(value, src[row + x - 1]) : Math.min(value, src[row + x - 1]);
      if (x < w - 1) value = useMax ? Math.max(value, src[row + x + 1]) : Math.min(value, src[row + x + 1]);
      horizontal[row + x] = value;
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = y * w + x;
      let value = horizontal[idx];
      if (y > 0) value = useMax ? Math.max(value, horizontal[idx - w]) : Math.min(value, horizontal[idx - w]);
      if (y < h - 1) value = useMax ? Math.max(value, horizontal[idx + w]) : Math.min(value, horizontal[idx + w]);
      result[idx] = value;
    }
  }
  state.currentAlpha.set(result);
  refreshMaskImage();
  pushHistory({ type: 'full', before, after: result });
  renderCanvas();
}

function refreshMaskImage() {
  for (let i = 0; i < state.currentAlpha.length; i++) state.maskImageData.data[i * 4 + 3] = state.currentAlpha[i];
  state.maskCtx.putImageData(state.maskImageData, 0, 0);
}

function resizeCanvas() {
  const stage = document.querySelector('#canvasStage');
  if (!stage || !state.canvas) return;
  const rect = stage.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  state.canvas.width = Math.max(1, Math.floor(rect.width * dpr));
  state.canvas.height = Math.max(1, Math.floor(rect.height * dpr));
  state.canvas.style.width = `${rect.width}px`;
  state.canvas.style.height = `${rect.height}px`;
  state.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  state.canvas._cssWidth = rect.width;
  state.canvas._cssHeight = rect.height;
  renderCanvas();
}

function renderCanvas() {
  if (!state.ctx || !state.originalImage) return;
  const ctx = state.ctx;
  const w = state.canvas._cssWidth || state.canvas.clientWidth;
  const h = state.canvas._cssHeight || state.canvas.clientHeight;
  ctx.clearRect(0, 0, w, h);

  const margin = 48;
  const fit = Math.min((w - margin * 2) / state.width, (h - margin * 2) / state.height);
  const displayScale = Math.max(0.0001, fit * state.zoom);
  const dw = state.width * displayScale;
  const dh = state.height * displayScale;
  const x = (w - dw) / 2 + state.panX;
  const y = (h - dh) / 2 + state.panY;
  state.imageRect = { x, y, width: dw, height: dh };

  ctx.save();
  ctx.shadowColor = state.theme === 'dark' ? 'rgba(0,0,0,.45)' : 'rgba(31,42,55,.14)';
  ctx.shadowBlur = 24;
  ctx.fillStyle = state.theme === 'dark' ? '#20242c' : '#ffffff';
  ctx.fillRect(x, y, dw, dh);
  ctx.restore();

  drawCheckerboard(ctx, x, y, dw, dh, Math.max(8, 14 * Math.min(state.zoom, 1.5)));

  const maxPreviewDimension = 2200;
  const previewScale = Math.min(1, maxPreviewDimension / Math.max(dw, dh));
  const previewW = Math.max(1, Math.round(dw * previewScale));
  const previewH = Math.max(1, Math.round(dh * previewScale));
  const render = renderCompositeCanvas({ width: previewW, height: previewH, transparentChecker: false });
  ctx.drawImage(render.canvas, x, y, dw, dh);

  if (state.activeTab === 'cutout' && !state.spaceDown) state.canvas.classList.add('brush-cursor');
  else state.canvas.classList.remove('brush-cursor');
}

function renderCompositeCanvas({ width, height, transparentChecker = false } = {}) {
  const baseW = width || state.width;
  const baseH = height || state.height;
  const canvas = document.createElement('canvas');
  canvas.width = baseW;
  canvas.height = baseH;
  const ctx = canvas.getContext('2d');

  if (transparentChecker) drawCheckerboard(ctx, 0, 0, baseW, baseH, 16);
  drawBackgroundTo(ctx, baseW, baseH);
  drawSubjectTo(ctx, baseW, baseH);
  return { canvas, ctx };
}

function drawBackgroundTo(ctx, w, h) {
  const type = state.background.type;

  if (type === 'transparent') {
    if (state.blurBackground > 0) {
      ctx.save();
      ctx.filter = `blur(${state.blurBackground}px)`;
      drawCover(ctx, state.originalImage, -24, -24, w + 48, h + 48, 0);
      ctx.restore();
    }
    return;
  }

  if (type === 'white' || type === 'black' || type === 'color') {
    ctx.fillStyle = type === 'white' ? '#ffffff' : type === 'black' ? '#000000' : state.background.color;
    ctx.fillRect(0, 0, w, h);
    return;
  }

  if (type === 'image' && state.background.image) {
    drawCover(ctx, state.background.image, 0, 0, w, h, state.blurBackground);
  }
}

function drawSubjectTo(ctx, w, h) {
  const fitScale = Math.min(w / state.width, h / state.height);
  const baseW = state.width * fitScale;
  const baseH = state.height * fitScale;
  const designScale = state.design.scale / 100;
  const sw = baseW * designScale;
  const sh = baseH * designScale;
  const x = (w - sw) / 2 + (state.design.offsetX / 100) * w;
  const y = (h - sh) / 2 + (state.design.offsetY / 100) * h;

  const subjectSourceW = Math.max(1, Math.round(baseW));
  const subjectSourceH = Math.max(1, Math.round(baseH));
  const subject = createSubjectCanvas(subjectSourceW, subjectSourceH);

  if (state.shadow.enabled) {
    ctx.save();
    ctx.globalAlpha = state.shadow.opacity;
    ctx.filter = `blur(${Math.max(0, state.shadow.blur * fitScale)}px)`;
    const shadowMask = getFeatheredMaskCanvas(subjectSourceW, subjectSourceH);
    const shadowCanvas = document.createElement('canvas');
    shadowCanvas.width = subjectSourceW;
    shadowCanvas.height = subjectSourceH;
    const sctx = shadowCanvas.getContext('2d');
    sctx.fillStyle = '#000000';
    sctx.fillRect(0, 0, subjectSourceW, subjectSourceH);
    sctx.globalCompositeOperation = 'destination-in';
    sctx.drawImage(shadowMask, 0, 0);
    ctx.drawImage(
      shadowCanvas,
      x + state.shadow.offsetX * fitScale,
      y + state.shadow.offsetY * fitScale,
      sw,
      sh
    );
    ctx.restore();
  }

  ctx.save();
  ctx.filter = `brightness(${state.adjust.brightness}%) contrast(${state.adjust.contrast}%) saturate(${state.adjust.saturation}%)`;
  ctx.drawImage(subject, x, y, sw, sh);
  ctx.restore();
}

function createSubjectCanvas(width = state.width, height = state.height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(state.originalImage, 0, 0, width, height);
  ctx.globalCompositeOperation = 'destination-in';
  ctx.drawImage(getFeatheredMaskCanvas(width, height), 0, 0, width, height);
  return canvas;
}

function getFeatheredMaskCanvas(width = state.width, height = state.height) {
  if (!state.feather && width === state.width && height === state.height) return state.maskCanvas;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  const scale = Math.min(width / state.width, height / state.height);
  if (state.feather) ctx.filter = `blur(${Math.max(0, state.feather * scale)}px)`;
  ctx.drawImage(state.maskCanvas, 0, 0, width, height);
  return canvas;
}

function drawCover(ctx, image, x, y, w, h, blur = 0) {
  const scale = Math.max(w / image.naturalWidth, h / image.naturalHeight);
  const dw = image.naturalWidth * scale;
  const dh = image.naturalHeight * scale;
  ctx.save();
  if (blur) ctx.filter = `blur(${blur}px)`;
  ctx.drawImage(image, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
  ctx.restore();
}

function drawCheckerboard(ctx, x, y, w, h, size = 14) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  const a = state.theme === 'dark' ? '#252a33' : '#ffffff';
  const b = state.theme === 'dark' ? '#303640' : '#edf0f3';
  for (let yy = 0; yy < h + size; yy += size) {
    for (let xx = 0; xx < w + size; xx += size) {
      ctx.fillStyle = ((xx / size + yy / size) % 2 === 0) ? a : b;
      ctx.fillRect(x + xx, y + yy, size, size);
    }
  }
  ctx.restore();
}

function canvasToImage(clientX, clientY) {
  const rect = state.canvas.getBoundingClientRect();
  const x = clientX - rect.left;
  const y = clientY - rect.top;
  const r = state.imageRect;
  if (!r || x < r.x || y < r.y || x > r.x + r.width || y > r.y + r.height) return null;
  return {
    x: ((x - r.x) / r.width) * state.width,
    y: ((y - r.y) / r.height) * state.height,
  };
}

function setZoom(value) {
  state.zoom = Math.max(0.15, Math.min(8, value));
  renderCanvas();
  updateZoomUI();
}

function updateZoomUI() {
  const readout = document.querySelector('#zoomReset');
  if (readout) readout.textContent = `${Math.round(state.zoom * 100)}%`;
}

function downloadModalMarkup() {
  return `
    <div class="modal-backdrop hidden" id="downloadModal" role="dialog" aria-modal="true" aria-labelledby="downloadTitle">
      <div class="modal-card download-card">
        <div class="modal-heading">
          <div><span class="eyebrow">Export</span><h2 id="downloadTitle">Download image</h2></div>
          <button class="icon-button" data-close-download aria-label="Close">${icon('close')}</button>
        </div>
        <div class="download-grid">
          <label><span>Format</span><select id="exportFormat"><option value="image/png">PNG</option><option value="image/webp">WebP</option><option value="image/jpeg">JPG</option></select></label>
          <label><span>Size</span><select id="exportPreset"><option value="original">Original (${state.width} × ${state.height})</option><option value="1080">1920 × 1080</option><option value="1440">2560 × 1440</option><option value="4k">3840 × 2160</option><option value="custom">Custom</option></select></label>
        </div>
        <div class="download-grid custom-size hidden" id="customSizeRow">
          <label><span>Width</span><input id="exportWidth" type="number" min="1" max="16384" value="${state.width}" /></label>
          <label><span>Height</span><input id="exportHeight" type="number" min="1" max="16384" value="${state.height}" /></label>
        </div>
        <label class="switch-row compact-switch"><span><strong>Lock aspect ratio</strong></span><input id="lockAspect" type="checkbox" checked /></label>
        <label class="switch-row compact-switch"><span><strong>Trim transparent pixels</strong><small>Crop to visible subject</small></span><input id="trimExport" type="checkbox" /></label>
        <label class="range-row" id="qualityRow"><div><span>Quality</span><output id="qualityOutput">92%</output></div><input id="exportQuality" type="range" min="40" max="100" value="92" /></label>
        <div class="export-summary" id="exportSummary"></div>
        <button class="download-button large" id="confirmDownload">${icon('download')} Download image</button>
      </div>
    </div>`;
}

function openDownloadModal() {
  const modal = document.querySelector('#downloadModal');
  modal.classList.remove('hidden');
  bindDownloadModal();
  updateExportSummary();
}

function bindDownloadModal() {
  const modal = document.querySelector('#downloadModal');
  const close = () => modal.classList.add('hidden');
  modal.onclick = (e) => { if (e.target === modal || e.target.closest('[data-close-download]')) close(); };
  const preset = document.querySelector('#exportPreset');
  const format = document.querySelector('#exportFormat');
  const width = document.querySelector('#exportWidth');
  const height = document.querySelector('#exportHeight');
  const lock = document.querySelector('#lockAspect');
  const quality = document.querySelector('#exportQuality');
  const ratio = state.width / state.height;

  preset.onchange = () => {
    const custom = preset.value === 'custom';
    document.querySelector('#customSizeRow').classList.toggle('hidden', !custom);
    updateExportSummary();
  };
  format.onchange = () => {
    document.querySelector('#qualityRow').classList.toggle('hidden', format.value === 'image/png');
    updateExportSummary();
  };
  width.oninput = () => {
    if (lock.checked) height.value = Math.max(1, Math.round(Number(width.value) / ratio));
    updateExportSummary();
  };
  height.oninput = () => {
    if (lock.checked) width.value = Math.max(1, Math.round(Number(height.value) * ratio));
    updateExportSummary();
  };
  quality.oninput = () => { document.querySelector('#qualityOutput').textContent = `${quality.value}%`; };
  document.querySelector('#trimExport').onchange = updateExportSummary;
  document.querySelector('#confirmDownload').onclick = exportImage;
}

function exportDimensions() {
  const preset = document.querySelector('#exportPreset')?.value || 'original';
  if (preset === '1080') return { width: 1920, height: 1080 };
  if (preset === '1440') return { width: 2560, height: 1440 };
  if (preset === '4k') return { width: 3840, height: 2160 };
  if (preset === 'custom') return {
    width: clampInt(document.querySelector('#exportWidth').value, 1, 16384),
    height: clampInt(document.querySelector('#exportHeight').value, 1, 16384),
  };
  return { width: state.width, height: state.height };
}

function updateExportSummary() {
  const el = document.querySelector('#exportSummary');
  if (!el) return;
  const { width, height } = exportDimensions();
  const format = document.querySelector('#exportFormat')?.selectedOptions?.[0]?.textContent || 'PNG';
  const trim = document.querySelector('#trimExport')?.checked;
  el.textContent = `${format} • ${trim ? 'Trimmed subject' : `${width} × ${height}`} • rendered locally`;
}

async function exportImage() {
  const button = document.querySelector('#confirmDownload');
  const originalLabel = button.innerHTML;
  button.disabled = true;
  button.textContent = 'Rendering…';
  try {
    const dims = exportDimensions();
    const format = document.querySelector('#exportFormat').value;
    const quality = Number(document.querySelector('#exportQuality').value) / 100;
    const trim = document.querySelector('#trimExport').checked;

    let { canvas } = renderCompositeCanvas(dims);
    if (format === 'image/jpeg' && state.background.type === 'transparent') {
      const jpegCanvas = document.createElement('canvas');
      jpegCanvas.width = canvas.width;
      jpegCanvas.height = canvas.height;
      const jctx = jpegCanvas.getContext('2d');
      jctx.fillStyle = '#ffffff';
      jctx.fillRect(0, 0, canvas.width, canvas.height);
      jctx.drawImage(canvas, 0, 0);
      canvas = jpegCanvas;
    }

    if (trim) canvas = trimCanvasToSubject(canvas, dims);
    const blob = await canvasToBlob(canvas, format, quality);
    const extension = format === 'image/jpeg' ? 'jpg' : format.split('/')[1];
    const filename = `${safeBaseName(state.file?.name || 'image')}-luvvy-cutout.${extension}`;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    document.querySelector('#downloadModal').classList.add('hidden');
    showToast(`Downloaded ${canvas.width} × ${canvas.height} ${extension.toUpperCase()}`);
  } catch (error) {
    console.error(error);
    showToast(`Export failed: ${error?.message || 'Unknown error'}`, 'error');
  } finally {
    button.disabled = false;
    button.innerHTML = originalLabel;
  }
}

function trimCanvasToSubject(composite, dims) {
  const mask = document.createElement('canvas');
  mask.width = dims.width;
  mask.height = dims.height;
  const mctx = mask.getContext('2d');
  const fitScale = Math.min(dims.width / state.width, dims.height / state.height);
  const baseW = state.width * fitScale;
  const baseH = state.height * fitScale;
  const scale = state.design.scale / 100;
  const sw = baseW * scale;
  const sh = baseH * scale;
  const x = (dims.width - sw) / 2 + (state.design.offsetX / 100) * dims.width;
  const y = (dims.height - sh) / 2 + (state.design.offsetY / 100) * dims.height;
  mctx.drawImage(getFeatheredMaskCanvas(Math.max(1, Math.round(baseW)), Math.max(1, Math.round(baseH))), x, y, sw, sh);
  const data = mctx.getImageData(0, 0, dims.width, dims.height).data;
  let minX = dims.width, minY = dims.height, maxX = -1, maxY = -1;
  for (let yy = 0; yy < dims.height; yy++) {
    for (let xx = 0; xx < dims.width; xx++) {
      if (data[(yy * dims.width + xx) * 4 + 3] > 4) {
        if (xx < minX) minX = xx;
        if (xx > maxX) maxX = xx;
        if (yy < minY) minY = yy;
        if (yy > maxY) maxY = yy;
      }
    }
  }
  if (maxX < minX || maxY < minY) return composite;
  const pad = Math.round(Math.max(dims.width, dims.height) * 0.01);
  minX = Math.max(0, minX - pad);
  minY = Math.max(0, minY - pad);
  maxX = Math.min(dims.width - 1, maxX + pad);
  maxY = Math.min(dims.height - 1, maxY + pad);
  const out = document.createElement('canvas');
  out.width = maxX - minX + 1;
  out.height = maxY - minY + 1;
  out.getContext('2d').drawImage(composite, minX, minY, out.width, out.height, 0, 0, out.width, out.height);
  return out;
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Browser could not encode the image.')), type, quality));
}

function clampInt(value, min, max) {
  const num = Math.round(Number(value));
  return Math.max(min, Math.min(max, Number.isFinite(num) ? num : min));
}

function safeBaseName(name) {
  return name.replace(/\.[^/.]+$/, '').replace(/[^a-z0-9_-]+/gi, '-').replace(/^-+|-+$/g, '') || 'image';
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]);
}

function showToast(message, type = 'success') {
  let host = document.querySelector('#toastHost');
  if (!host) {
    host = document.createElement('div');
    host.id = 'toastHost';
    host.className = 'toast-host';
    document.body.appendChild(host);
  }
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  host.appendChild(toast);
  setTimeout(() => toast.classList.add('show'), 20);
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 220);
  }, 3400);
}

setTheme(state.theme);
renderLanding();
