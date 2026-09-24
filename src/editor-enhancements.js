import './editor-enhancements.css';

let sourceUrl = null;
let sourceImage = null;
let mountedStage = null;
let mountedCanvas = null;
let originalOverlay = null;
let brushCursor = null;
let brushInner = null;
let previewBadge = null;
let stageResizeObserver = null;
let previewHeld = false;
let pointerInsideCanvas = false;
let lastPointer = null;
let spaceDown = false;
let isMirroringPan = false;
let mirrorPanStart = null;

const view = {
  zoom: 1,
  panX: 0,
  panY: 0,
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function isImageFile(file) {
  return file instanceof File && file.type.startsWith('image/');
}

function resetView() {
  view.zoom = 1;
  view.panX = 0;
  view.panY = 0;
  updateOverlayTransform();
}

async function captureSourceFile(file) {
  if (!isImageFile(file)) return;

  if (sourceUrl) URL.revokeObjectURL(sourceUrl);
  sourceUrl = URL.createObjectURL(file);
  sourceImage = new Image();
  sourceImage.decoding = 'async';
  sourceImage.src = sourceUrl;
  resetView();

  try {
    await sourceImage.decode();
  } catch {
    await new Promise((resolve) => {
      sourceImage.onload = resolve;
      sourceImage.onerror = resolve;
    });
  }

  if (originalOverlay) originalOverlay.src = sourceUrl;
  updateOverlayTransform();
  updateOriginalVisibility();
}

function activeCutoutTab() {
  return document.querySelector('[data-tab="cutout"]')?.classList.contains('active') ?? false;
}

function activeBrushTool() {
  return document.querySelector('#sidePanel [data-tool].active')?.dataset.tool || 'erase';
}

function brushRadiusOnScreen() {
  const value = Number(document.querySelector('#brushSize')?.value || 52);
  return clamp(value, 1, 500);
}

function brushHardness() {
  return clamp(Number(document.querySelector('#brushHardness')?.value || 82) / 100, 0.05, 1);
}

function canvasMetrics() {
  if (!mountedStage || !mountedCanvas || !sourceImage?.naturalWidth || !sourceImage?.naturalHeight) return null;

  const stageRect = mountedStage.getBoundingClientRect();
  const canvasRect = mountedCanvas.getBoundingClientRect();
  const width = canvasRect.width;
  const height = canvasRect.height;
  const margin = 48;
  const fit = Math.min(
    Math.max(1, width - margin * 2) / sourceImage.naturalWidth,
    Math.max(1, height - margin * 2) / sourceImage.naturalHeight,
  );
  const displayScale = Math.max(0.0001, fit * view.zoom);
  const imageWidth = sourceImage.naturalWidth * displayScale;
  const imageHeight = sourceImage.naturalHeight * displayScale;
  const canvasOffsetX = canvasRect.left - stageRect.left;
  const canvasOffsetY = canvasRect.top - stageRect.top;

  return {
    stageRect,
    canvasRect,
    x: canvasOffsetX + (width - imageWidth) / 2 + view.panX,
    y: canvasOffsetY + (height - imageHeight) / 2 + view.panY,
    width: imageWidth,
    height: imageHeight,
  };
}

function updateOverlayTransform() {
  if (!originalOverlay) return;
  const metrics = canvasMetrics();
  if (!metrics) {
    originalOverlay.style.opacity = '0';
    return;
  }

  originalOverlay.style.left = `${metrics.x}px`;
  originalOverlay.style.top = `${metrics.y}px`;
  originalOverlay.style.width = `${metrics.width}px`;
  originalOverlay.style.height = `${metrics.height}px`;

  updateOriginalVisibility();
  if (lastPointer) updateBrushCursor(lastPointer);
}

function updateOriginalVisibility() {
  if (!originalOverlay) return;

  const inCutout = activeCutoutTab();
  const restoreReference = inCutout && activeBrushTool() === 'restore';
  const visible = sourceImage && inCutout && (previewHeld || restoreReference);

  originalOverlay.classList.toggle('full-original-preview', previewHeld);
  originalOverlay.classList.toggle('restore-reference-preview', !previewHeld && restoreReference);
  originalOverlay.style.opacity = visible ? (previewHeld ? '1' : '0.26') : '0';

  if (previewBadge) {
    previewBadge.textContent = previewHeld ? 'Original image' : 'Restore reference';
    previewBadge.classList.toggle('visible', Boolean(visible));
    previewBadge.classList.toggle('reference', !previewHeld && restoreReference);
  }
}

function updateBrushCursor(event) {
  if (!brushCursor || !mountedStage || !mountedCanvas) return;
  lastPointer = event;

  if (event.pointerType === 'touch' || !activeCutoutTab() || spaceDown || isMirroringPan) {
    hideBrushCursor();
    return;
  }

  const metrics = canvasMetrics();
  if (!metrics) {
    hideBrushCursor();
    return;
  }

  const x = event.clientX - metrics.stageRect.left;
  const y = event.clientY - metrics.stageRect.top;
  const withinImage = x >= metrics.x && x <= metrics.x + metrics.width && y >= metrics.y && y <= metrics.y + metrics.height;
  if (!withinImage) {
    hideBrushCursor();
    return;
  }

  const radius = brushRadiusOnScreen();
  const hardness = brushHardness();
  const tool = activeBrushTool();

  brushCursor.dataset.tool = tool;
  brushCursor.style.width = `${radius * 2}px`;
  brushCursor.style.height = `${radius * 2}px`;
  brushCursor.style.transform = `translate(${x - radius}px, ${y - radius}px)`;
  brushCursor.classList.add('visible');

  if (brushInner) {
    const innerDiameter = Math.max(2, radius * 2 * hardness);
    brushInner.style.width = `${innerDiameter}px`;
    brushInner.style.height = `${innerDiameter}px`;
  }

  mountedCanvas.classList.add('enhanced-brush-active');
}

function hideBrushCursor() {
  brushCursor?.classList.remove('visible');
  mountedCanvas?.classList.remove('enhanced-brush-active');
}

function setOriginalPreviewHeld(value) {
  previewHeld = Boolean(value);
  updateOriginalVisibility();
}

function addPreviewControls() {
  const panel = document.querySelector('#sidePanel');
  if (!panel || !activeCutoutTab() || panel.querySelector('#originalPreviewControl')) return;

  const segmented = panel.querySelector('.segmented-control');
  if (!segmented) return;

  const control = document.createElement('div');
  control.id = 'originalPreviewControl';
  control.className = 'original-preview-control';
  control.innerHTML = `
    <button type="button" class="secondary-button original-preview-button" id="holdOriginalButton">
      <span class="preview-eye" aria-hidden="true">◉</span>
      Hold to view original
    </button>
    <small>Restore mode shows removed pixels faintly so you can paint them back precisely. Hold this button, or hold O, to see the untouched image at full strength.</small>
  `;

  segmented.insertAdjacentElement('afterend', control);
  const button = control.querySelector('#holdOriginalButton');

  button.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    button.setPointerCapture?.(event.pointerId);
    setOriginalPreviewHeld(true);
  });
  button.addEventListener('pointerup', () => setOriginalPreviewHeld(false));
  button.addEventListener('pointercancel', () => setOriginalPreviewHeld(false));
  button.addEventListener('lostpointercapture', () => setOriginalPreviewHeld(false));
  button.addEventListener('keydown', (event) => {
    if (event.code === 'Space' || event.code === 'Enter') {
      event.preventDefault();
      setOriginalPreviewHeld(true);
    }
  });
  button.addEventListener('keyup', (event) => {
    if (event.code === 'Space' || event.code === 'Enter') {
      event.preventDefault();
      setOriginalPreviewHeld(false);
    }
  });
}

function mountEditorEnhancements() {
  const stage = document.querySelector('#canvasStage');
  const canvas = document.querySelector('#editorCanvas');
  if (!stage || !canvas) {
    mountedStage = null;
    mountedCanvas = null;
    return;
  }

  if (mountedStage !== stage || mountedCanvas !== canvas) {
    stageResizeObserver?.disconnect();
    mountedStage = stage;
    mountedCanvas = canvas;

    originalOverlay = document.createElement('img');
    originalOverlay.id = 'cutoutOriginalOverlay';
    originalOverlay.className = 'cutout-original-overlay';
    originalOverlay.alt = '';
    originalOverlay.draggable = false;
    if (sourceUrl) originalOverlay.src = sourceUrl;

    brushCursor = document.createElement('div');
    brushCursor.id = 'cutoutBrushCursor';
    brushCursor.className = 'cutout-brush-cursor';
    brushCursor.innerHTML = '<span class="brush-hardness-ring"></span>';
    brushInner = brushCursor.firstElementChild;

    previewBadge = document.createElement('div');
    previewBadge.className = 'original-preview-badge';
    previewBadge.textContent = 'Original image';

    stage.append(originalOverlay, brushCursor, previewBadge);

    canvas.addEventListener('pointerenter', (event) => {
      pointerInsideCanvas = true;
      updateBrushCursor(event);
    });
    canvas.addEventListener('pointermove', (event) => {
      pointerInsideCanvas = true;
      updateBrushCursor(event);
    });
    canvas.addEventListener('pointerleave', () => {
      pointerInsideCanvas = false;
      hideBrushCursor();
    });

    stageResizeObserver = new ResizeObserver(updateOverlayTransform);
    stageResizeObserver.observe(stage);
  }

  addPreviewControls();
  updateOverlayTransform();
  updateOriginalVisibility();
}

function scheduleMount() {
  requestAnimationFrame(mountEditorEnhancements);
}

document.addEventListener('change', (event) => {
  if (event.target?.id === 'fileInput') {
    const file = event.target.files?.[0];
    if (file) captureSourceFile(file);
  }
}, true);

document.addEventListener('drop', (event) => {
  const file = [...(event.dataTransfer?.files || [])].find(isImageFile);
  if (file) captureSourceFile(file);
}, true);

document.addEventListener('paste', (event) => {
  const file = [...(event.clipboardData?.files || [])].find(isImageFile);
  if (file) captureSourceFile(file);
}, true);

document.addEventListener('click', (event) => {
  const target = event.target.closest?.('button, [data-tool]');
  if (!target) return;

  if (target.id === 'zoomIn') view.zoom = clamp(view.zoom * 1.18, 0.15, 8);
  if (target.id === 'zoomOut') view.zoom = clamp(view.zoom / 1.18, 0.15, 8);
  if (target.id === 'zoomReset' || target.id === 'fitBtn') resetView();
  if (target.id === 'rerunRemoval') resetView();

  if (target.matches('[data-tool]')) {
    queueMicrotask(() => {
      updateOriginalVisibility();
      if (lastPointer && pointerInsideCanvas) updateBrushCursor(lastPointer);
    });
  }

  if (target.matches('[data-tab]')) {
    queueMicrotask(scheduleMount);
  }

  updateOverlayTransform();
});

document.addEventListener('input', (event) => {
  if (event.target?.id === 'brushSize' || event.target?.id === 'brushHardness') {
    if (lastPointer && pointerInsideCanvas) updateBrushCursor(lastPointer);
  }
});

document.addEventListener('wheel', (event) => {
  if (event.target?.id !== 'editorCanvas') return;
  view.zoom = clamp(view.zoom * (event.deltaY < 0 ? 1.1 : 0.9), 0.15, 8);
  updateOverlayTransform();
}, { capture: true, passive: true });

document.addEventListener('pointerdown', (event) => {
  if (event.target?.id !== 'editorCanvas') return;
  const shouldPan = spaceDown || event.button === 1 || !activeCutoutTab();
  if (!shouldPan) return;

  isMirroringPan = true;
  mirrorPanStart = {
    clientX: event.clientX,
    clientY: event.clientY,
    panX: view.panX,
    panY: view.panY,
  };
  hideBrushCursor();
}, true);

document.addEventListener('pointermove', (event) => {
  if (!isMirroringPan || !mirrorPanStart) return;
  view.panX = mirrorPanStart.panX + (event.clientX - mirrorPanStart.clientX);
  view.panY = mirrorPanStart.panY + (event.clientY - mirrorPanStart.clientY);
  updateOverlayTransform();
}, true);

function endMirroredPan() {
  isMirroringPan = false;
  mirrorPanStart = null;
  if (lastPointer && pointerInsideCanvas) updateBrushCursor(lastPointer);
}

document.addEventListener('pointerup', endMirroredPan, true);
document.addEventListener('pointercancel', endMirroredPan, true);

document.addEventListener('keydown', (event) => {
  if (event.code === 'Space' && !isTypingTarget(event.target)) {
    spaceDown = true;
    hideBrushCursor();
  }
  if (event.key.toLowerCase() === 'o' && !event.repeat && !isTypingTarget(event.target) && activeCutoutTab()) {
    setOriginalPreviewHeld(true);
  }
});

document.addEventListener('keyup', (event) => {
  if (event.code === 'Space') {
    spaceDown = false;
    if (lastPointer && pointerInsideCanvas) updateBrushCursor(lastPointer);
  }
  if (event.key.toLowerCase() === 'o') setOriginalPreviewHeld(false);
});

window.addEventListener('blur', () => {
  setOriginalPreviewHeld(false);
  spaceDown = false;
  endMirroredPan();
});

function isTypingTarget(target) {
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target?.isContentEditable;
}

const appObserver = new MutationObserver(scheduleMount);
appObserver.observe(document.querySelector('#app'), { childList: true, subtree: true });
scheduleMount();
