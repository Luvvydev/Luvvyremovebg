import { pipeline, env } from '@huggingface/transformers';

env.allowRemoteModels = true;
env.allowLocalModels = false;
if ('useBrowserCache' in env) env.useBrowserCache = true;

const MODEL_ID = 'kn4666/bria-rmbg-2.0-web';
let removerPromise = null;

export async function removeBackgroundQuality(file, onProgress = () => {}) {
  onProgress(5, 'Preparing BRIA RMBG 2.0…');
  const remover = await getRemover(onProgress);
  onProgress(86, 'Running high quality cutout…');
  const output = await remover(file);
  const blob = await rawImageToPngBlob(output);
  onProgress(100, 'Building editable cutout…');
  return blob;
}

async function getRemover(onProgress) {
  if (removerPromise) return removerPromise;

  removerPromise = pipeline('background-removal', MODEL_ID, {
    device: 'wasm',
    dtype: 'q8',
    progress_callback: (info) => reportLoadProgress(info, onProgress),
  }).catch((error) => {
    removerPromise = null;
    throw error;
  });

  return removerPromise;
}

function reportLoadProgress(info, onProgress) {
  let percent = 8;
  if (typeof info?.progress === 'number') {
    percent = info.progress <= 1
      ? Math.round(info.progress * 78)
      : Math.round(info.progress * 0.78);
  } else if (typeof info?.loaded === 'number' && typeof info?.total === 'number' && info.total > 0) {
    percent = Math.round((info.loaded / info.total) * 78);
  }
  percent = Math.max(5, Math.min(78, percent));

  const label = info?.status === 'progress' || info?.status === 'download'
    ? 'Downloading BRIA RMBG 2.0 model…'
    : info?.status === 'initiate'
      ? 'Connecting to model host…'
      : 'Preparing BRIA RMBG 2.0…';

  onProgress(percent, label);
}

function rawImageToPngBlob(image) {
  if (!image?.data || !image?.width || !image?.height) {
    throw new Error('BRIA RMBG 2.0 did not return an image.');
  }

  const channels = image.channels || Math.round(image.data.length / (image.width * image.height));
  if (channels !== 4) {
    throw new Error('BRIA RMBG 2.0 returned an image without an alpha channel.');
  }

  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  const ctx = canvas.getContext('2d');
  const pixels = new Uint8ClampedArray(image.data);
  ctx.putImageData(new ImageData(pixels, image.width, image.height), 0, 0);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Browser could not encode the BRIA cutout.'));
    }, 'image/png');
  });
}
