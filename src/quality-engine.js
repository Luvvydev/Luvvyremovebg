import './quality.css';
import './smart-ui.js';
import { runSmart } from './smart-engine.js';

const OVERRIDE_KEY = 'luvvy-smart-engine';

export async function removeBackgroundQuality(file, onProgress = () => {}) {
  const image = await fileImage(file);
  const requested = localStorage.getItem(OVERRIDE_KEY) || 'smart';
  const result = await runSmart(file, image, requested === 'fast' ? 'smart' : requested, onProgress);
  return alphaToPng(file, image, result.alpha);
}

async function fileImage(file) {
  const url = URL.createObjectURL(file);
  try {
    return await new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = url;
    });
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}

async function alphaToPng(file, image, alpha) {
  const source = await createImageBitmap(file);
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  source.close?.();
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
  for (let i = 0, p = 3; i < alpha.length; i++, p += 4) pixels.data[p] = alpha[i];
  ctx.putImageData(pixels, 0, 0);
  return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Could not encode cutout.')), 'image/png'));
}
