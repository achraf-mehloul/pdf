// Holds the canonical page list. Each page: { id, blob, originalBlob, rotation (0/90/180/270), filter, croppedBlob }
const pages = [];
let onPageChangeCb = null;

export function setOnPageChange(cb) { onPageChangeCb = cb; }

function notify() { if (onPageChangeCb) onPageChangeCb(pages); }

export async function addFiles(files) {
  for (const file of files) {
    if (!/^image\/(jpeg|jpg|png|webp)$/i.test(file.type)) continue;
    const id = crypto.randomUUID();
    const page = { id, blob: file, originalBlob: file, rotation: 0, filter: 'original', croppedBlob: null };
    pages.push(page);
  }
  notify();
  return pages;
}

export function getPages() { return pages.slice(); }

export function removePage(id) {
  const i = pages.findIndex(p => p.id === id);
  if (i !== -1) { pages.splice(i, 1); notify(); }
}

export function rotatePage(id) {
  const p = pages.find(p => p.id === id);
  if (p) { p.rotation = (p.rotation + 90) % 360; notify(); }
}

export function movePage(id, dir) {
  const i = pages.findIndex(p => p.id === id);
  if (i === -1) return;
  const j = i + dir;
  if (j < 0 || j >= pages.length) return;
  [pages[i], pages[j]] = [pages[j], pages[i]];
  notify();
}

export function clearPages() { pages.length = 0; notify(); }

export function updatePageBlob(id, newBlob, filter) {
  const p = pages.find(p => p.id === id);
  if (p) { p.blob = newBlob; p.filter = filter; notify(); }
}

// Render a preview list into a container element
export function renderPreviewList(containerId, pageList, opts = {}) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = '';
  pageList.forEach((page, idx) => {
    const div = document.createElement('div');
    div.className = 'preview-item';
    div.innerHTML = `<span class="page-num">${idx + 1}</span>`;
    const img = document.createElement('img');
    img.alt = `Page ${idx + 1}`;
    const url = URL.createObjectURL(page.blob);
    img.src = url;
    img.onload = () => URL.revokeObjectURL(url);
    div.appendChild(img);
    const actions = document.createElement('div');
    actions.className = 'actions';
    // Rotate
    const rotBtn = document.createElement('button');
    rotBtn.textContent = '↻'; rotBtn.title = 'Rotate';
    rotBtn.onclick = () => rotatePage(page.id);
    actions.appendChild(rotBtn);
    // Move up / down
    const upBtn = document.createElement('button');
    upBtn.textContent = '↑'; upBtn.onclick = () => movePage(page.id, -1);
    const downBtn = document.createElement('button');
    downBtn.textContent = '↓'; downBtn.onclick = () => movePage(page.id, 1);
    actions.appendChild(upBtn); actions.appendChild(downBtn);
    // Delete
    const delBtn = document.createElement('button');
    delBtn.textContent = '✕'; delBtn.onclick = () => removePage(page.id);
    actions.appendChild(delBtn);
    // Crop (only for image list, not scan preview for simplicity; scan uses its own flow)
    if (!opts.isScanned) {
      const cropBtn = document.createElement('button');
      cropBtn.textContent = '✂'; cropBtn.title = 'Crop & Enhance';
      cropBtn.onclick = () => openCropEditor(page);
      actions.appendChild(cropBtn);
    }
    div.appendChild(actions);
    container.appendChild(div);
  });
}

// ---------- Crop Editor ----------
let cropState = null; // { page, img, canvas, ctx, corners, displayScale }

function openCropEditor(page) {
  const modal = document.getElementById('crop-modal');
  modal.hidden = false;
  const canvas = document.getElementById('crop-canvas');
  const ctx = canvas.getContext('2d');
  const img = new Image();
  const url = URL.createObjectURL(page.blob);
  img.onload = () => {
    URL.revokeObjectURL(url);
    const maxW = Math.min(img.width, 800);
    const scale = maxW / img.width;
    canvas.width = img.width * scale;
    canvas.height = img.height * scale;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    // initial corners: 10% inset
    const inset = 0.1;
    cropState = {
      page, img, canvas, ctx,
      displayScale: scale,
      corners: [
        { x: canvas.width * inset, y: canvas.height * inset },
        { x: canvas.width * (1 - inset), y: canvas.height * inset },
        { x: canvas.width * (1 - inset), y: canvas.height * (1 - inset) },
        { x: canvas.width * inset, y: canvas.height * (1 - inset) },
      ],
      dragging: -1,
      originalCorners: null,
    };
    cropState.originalCorners = cropState.corners.map(c => ({ ...c }));
    drawOverlay();
  };
  img.src = url;

  // Reset
  document.getElementById('crop-reset-btn').onclick = () => {
    if (cropState) {
      cropState.corners = cropState.originalCorners.map(c => ({ ...c }));
      redrawCropCanvas(); drawOverlay();
    }
  };
  // Cancel
  document.getElementById('crop-cancel-btn').onclick = () => { modal.hidden = true; cropState = null; };
  // Apply
  document.getElementById('crop-apply-btn').onclick = async () => {
    if (!cropState) return;
    const filter = document.getElementById('filter-select').value;
    try {
      const blob = await applyCropAndFilter(cropState, filter);
      updatePageBlob(page.id, blob, filter);
      modal.hidden = true; cropState = null;
    } catch (e) { alert('Crop failed: ' + e.message); }
  };
}

function redrawCropCanvas() {
  const { ctx, img, canvas } = cropState;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
}

function drawOverlay() {
  const { ctx, canvas, corners } = cropState;
  // Redraw base image first
  redrawCropCanvas();
  // Draw polygon
  ctx.save();
  ctx.strokeStyle = '#e74c3c';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(corners[0].x, corners[0].y);
  for (let i = 1; i < 4; i++) ctx.lineTo(corners[i].x, corners[i].y);
  ctx.closePath();
  ctx.stroke();
  // Darken outside
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.rect(0, 0, canvas.width, canvas.height);
  ctx.moveTo(corners[0].x, corners[0].y);
  for (let i = 1; i < 4; i++) ctx.lineTo(corners[i].x, corners[i].y);
  ctx.closePath();
  ctx.fill('evenodd');
  // Draw handles
  corners.forEach((c, i) => {
    ctx.beginPath();
    ctx.arc(c.x, c.y, 8, 0, Math.PI * 2);
    ctx.fillStyle = i === cropState.dragging ? '#f39c12' : '#2980b9';
    ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
  });
  ctx.restore();
}

// Pointer events on crop canvas
(function setupCropDragging() {
  const canvas = document.getElementById('crop-canvas');
  function getPos(e) {
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: (clientX - rect.left) * (canvas.width / rect.width),
      y: (clientY - rect.top) * (canvas.height / rect.height),
    };
  }
  function onStart(e) {
    if (!cropState) return;
    const pos = getPos(e);
    for (let i = 0; i < 4; i++) {
      const c = cropState.corners[i];
      if (Math.hypot(pos.x - c.x, pos.y - c.y) < 20) {
        cropState.dragging = i;
        e.preventDefault();
        return;
      }
    }
  }
  function onMove(e) {
    if (!cropState || cropState.dragging < 0) return;
    e.preventDefault();
    const pos = getPos(e);
    // Clamp within canvas
    pos.x = Math.max(0, Math.min(cropState.canvas.width, pos.x));
    pos.y = Math.max(0, Math.min(cropState.canvas.height, pos.y));
    cropState.corners[cropState.dragging] = pos;
    drawOverlay();
  }
  function onEnd() { if (cropState) cropState.dragging = -1; drawOverlay(); }

  canvas.addEventListener('mousedown', onStart);
  canvas.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onEnd);
  canvas.addEventListener('touchstart', onStart, { passive: false });
  canvas.addEventListener('touchmove', onMove, { passive: false });
  canvas.addEventListener('touchend', onEnd);
})();

// Apply crop (approximate axis-aligned from corners) + filter using Canvas
async function applyCropAndFilter(state, filter) {
  const { img, corners } = state;
  // Compute bounding box of corners (axis-aligned crop as fallback; OpenCV not available here for full perspective)
  const xs = corners.map(c => c.x), ys = corners.map(c => c.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  // Map back to original image coordinates
  const sx = img.width / state.canvas.width;
  const sy = img.height / state.canvas.height;
  const cropX = minX * sx, cropY = minY * sy;
  const cropW = (maxX - minX) * sx, cropH = (maxY - minY) * sy;
  if (cropW < 10 || cropH < 10) throw new Error('Crop region too small');

  const outCanvas = document.createElement('canvas');
  outCanvas.width = Math.round(cropW); outCanvas.height = Math.round(cropH);
  const outCtx = outCanvas.getContext('2d');
  outCtx.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, outCanvas.width, outCanvas.height);
  applyFilterToCanvas(outCtx, outCanvas.width, outCanvas.height, filter);
  return new Promise((resolve, reject) => {
    outCanvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('toBlob failed')), 'image/jpeg', 0.92);
  });
}

export function applyFilterToCanvas(ctx, w, h, filter) {
  if (filter === 'original') return;
  const imageData = ctx.getImageData(0, 0, w, h);
  const d = imageData.data;
  for (let i = 0; i < d.length; i += 4) {
    let r = d[i], g = d[i+1], b = d[i+2];
    if (filter === 'grayscale' || filter === 'bw') {
      const avg = 0.299*r + 0.587*g + 0.114*b;
      r = g = b = avg;
      if (filter === 'bw') { const v = avg > 128 ? 255 : 0; r = g = b = v; }
    } else if (filter === 'enhanced') {
      // Simple contrast + saturation boost
      r = Math.min(255, Math.max(0, (r - 128) * 1.2 + 128 + 10));
      g = Math.min(255, Math.max(0, (g - 128) * 1.2 + 128 + 10));
      b = Math.min(255, Math.max(0, (b - 128) * 1.2 + 128 + 10));
    } else if (filter === 'highcontrast') {
      const factor = 2.0;
      r = Math.min(255, Math.max(0, (r - 128) * factor + 128));
      g = Math.min(255, Math.max(0, (g - 128) * factor + 128));
      b = Math.min(255, Math.max(0, (b - 128) * factor + 128));
    }
    d[i] = r; d[i+1] = g; d[i+2] = b;
  }
  ctx.putImageData(imageData, 0, 0);
}

// Render a page to a canvas with rotation + filter applied, returning a Blob
export async function renderPageToBlob(page, quality = 0.92) {
  const img = await loadImage(page.blob);
  const rot = page.rotation || 0;
  const swap = rot === 90 || rot === 270;
  const w = swap ? img.height : img.width;
  const h = swap ? img.width : img.height;
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.save();
  ctx.translate(w / 2, h / 2);
  ctx.rotate((rot * Math.PI) / 180);
  ctx.drawImage(img, -img.width / 2, -img.height / 2);
  ctx.restore();
  applyFilterToCanvas(ctx, w, h, page.filter || 'original');
  return new Promise((resolve, reject) => {
    canvas.toBlob(b => b ? resolve(b) : reject(new Error('toBlob failed')), 'image/jpeg', quality);
  });
}

function loadImage(blob) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Image load failed')); };
    img.src = url;
  });
}