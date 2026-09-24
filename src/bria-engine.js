import { pipeline, env } from '@huggingface/transformers';

env.allowRemoteModels = true;
env.allowLocalModels = false;
if ('useBrowserCache' in env) env.useBrowserCache = true;

const MODEL_ID = 'kn4666/bria-rmbg-2.0-web';
let removerPromise = null;

export async function runBria(file, onProgress = () => {}) {
  onProgress(5, 'Preparing BRIA RMBG 2.0…');
  const remover = await getRemover(onProgress);
  onProgress(86, 'Running general cutout…');
  const output = await remover(file);
  onProgress(100, 'Building editable cutout…');
  return output;
}

async function getRemover(onProgress) {
  if (removerPromise) return removerPromise;
  removerPromise = pipeline('background-removal', MODEL_ID, {
    device: 'wasm',
    dtype: 'q8',
    progress_callback: (info) => report(info, onProgress),
  }).catch((error) => {
    removerPromise = null;
    throw error;
  });
  return removerPromise;
}

function report(info, onProgress) {
  let percent = 8;
  if (typeof info?.progress === 'number') {
    percent = info.progress <= 1 ? Math.round(info.progress * 78) : Math.round(info.progress * 0.78);
  } else if (typeof info?.loaded === 'number' && typeof info?.total === 'number' && info.total > 0) {
    percent = Math.round((info.loaded / info.total) * 78);
  }
  onProgress(Math.max(5, Math.min(78, percent)), info?.status === 'progress' ? 'Downloading BRIA model…' : 'Preparing BRIA model…');
}
