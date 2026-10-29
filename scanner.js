// Scanner module. Uses OpenCV.js for auto edge detection if available; otherwise manual crop.
let video = null, stream = null, overlayCanvas = null, overlayCtx = null;
let scannedPages = []; // { id, blob, rotation, filter }
let currentFacing = 'environment';
let onPagesChanged = null, onToast = null;
let rafId = null;
let cvReady = false;

export async function openScanner({ onPagesChanged: cb, onToast: toast }) {
  onPagesChanged = cb; onToast = toast;
  video = document.getElementById('camera-video');
  overlayCanvas = document.getElementById('camera-overlay-canvas');
  overlayCtx = overlayCanvas.getContext('2d');

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    throw new Error('Camera not supported in this browser');
  }

  // Try to load OpenCV.js locally (optional). If it fails, we fall back gracefully.
  try {
    if (typeof cv === 'undefined') {
      await loadScript('./libs/opencv.js');
    }
    // Wait for cv to be ready (Module runtime)
    if (typeof cv !== 'undefined') {
      if (cv && cv.Mat) { cvReady = true; }
      else if (cv && cv.onRuntimeInitialized !== undefined) {
        await new Promise(res => { cv.onRuntimeInitialized = res; });
        cvReady = true;
      }
    }
  } catch (e) {
    cvReady = false;
    if (onToast) onToast('Auto-detect unavailable — manual crop only', false);
  }

  await startStream(currentFacing);

  // Overlay resize
  function resizeOverlay() {
    if (video.videoWidth) {
      overlayCanvas.width = video.videoWidth;
      overlayCanvas.height = video.videoHeight;
    }
  }
  video.addEventListener('loadedmetadata', resizeOverlay);
  resizeOverlay();

  // Start detection loop (draws detected contour if cvReady)
  startDetectionLoop();

  // Capture button handler
  const captureBtn = document.getElementById('capture-btn');
  captureBtn.onclick = () => captureFrame();

  window._switchCamera = async () => {
    currentFacing = currentFacing === 'environment' ? 'user' : 'environment';
    await stopStream();
    await startStream(currentFacing);
  };
}

export async function closeScanner() {
  if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
  await stopStream();
  video = null; overlayCanvas = null;
  window._switchCamera = null;
}

async function startStream(facing) {
  const constraints = {
    video: {
      facingMode: { ideal: facing },
      width: { ideal: 1280 },
      height: { ideal: 960 },
    },
    audio: false,
  };
  try {
    stream = await navigator.mediaDevices.getUserMedia(constraints);
  } catch (e) {
    // Fallback without facingMode
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    } catch (e2) {
      throw new Error(mapCameraError(e2));
    }
  }
  video.srcObject = stream;
  await video.play();
  document.getElementById('camera-view-container').classList.add('active');
  // Show scanned preview if any
  renderScanned();
}

async function stopStream() {
  if (stream) {
    stream.getTracks().forEach(t => t.stop());
    stream = null;
  }
  if (video) video.srcObject = null;
}

function mapCameraError(e) {
  switch (e.name) {
    case 'NotAllowedError': return 'Camera permission denied. Please allow camera access.';
    case 'NotFoundError': return 'No camera found on this device.';
    case 'NotReadableError': return 'Camera is in use by another application.';
    case 'OverconstrainedError': return 'Camera constraints could not be satisfied.';
    default: return 'Camera error: ' + e.message;
  }
}

function startDetectionLoop() {
  function loop() {
    if (!video || !overlayCanvas) return;
    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      if (overlayCanvas.width !== video.videoWidth) {
        overlayCanvas.width = video.videoWidth;
        overlayCanvas.height = video.videoHeight;
      }
      overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
      if (cvReady) {
        try { detectAndDraw(); } catch (e) { /* ignore detection errors */ }
      } else {
        // draw simple guide rectangle so user knows where to align
        overlayCtx.strokeStyle = 'rgba(52,152,219,0.7)';
        overlayCtx.lineWidth = 3;
        const m = 0.1;
        overlayCtx.strokeRect(
          overlayCanvas.width * m, overlayCanvas.height * m,
          overlayCanvas.width * (1 - 2*m), overlayCanvas.height * (1 - 2*m)
        );
      }
    }
    rafId = requestAnimationFrame(loop);
  }
  loop();
}

let lastCorners = null;
function detectAndDraw() {
  const w = video.videoWidth, h = video.videoHeight;
  // Downscale for performance
  const scale = 0.5;
  const smallW = Math.round(w * scale), smallH = Math.round(h * scale);
  const tmp = document.createElement('canvas');
  tmp.width = smallW; tmp.height = smallH;
  const tctx = tmp.getContext('2d');
  tctx.drawImage(video, 0, 0, smallW, smallH);

  let src = cv.imread(tmp);
  let gray = new cv.Mat(), blur = new cv.Mat(), edges = new cv.Mat();
  cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
  cv.GaussianBlur(gray, blur, new cv.Size(5,5), 0);
  cv.Canny(blur, edges, 75, 200);

  let contours = new cv.MatVector();
  let hierarchy = new cv.Mat();
  cv.findContours(edges, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

  let best = null, bestArea = 0;
  for (let i = 0; i < contours.size(); i++) {
    const cnt = contours.get(i);
    const area = cv.contourArea(cnt);
    if (area < 5000 * scale * scale) continue;
    const approx = new cv.Mat();
    const peri = cv.arcLength(cnt, true);
    cv.approxPolyDP(cnt, approx, 0.02 * peri, true);
    if (approx.rows === 4 && area > bestArea) {
      bestArea = area; best = approx;
    } else { approx.delete(); }
    cnt.delete();
  }
  contours.delete(); hierarchy.delete();

  if (best) {
    const pts = [];
    for (let i = 0; i < 4; i++) {
      pts.push({ x: best.intPtr(i, 0)[0] / scale, y: best.intPtr(i, 0)[1] / scale });
    }
    lastCorners = pts;
    // Draw on overlay
    overlayCtx.strokeStyle = '#2ecc71';
    overlayCtx.lineWidth = 3;
    overlayCtx.beginPath();
    overlayCtx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < 4; i++) overlayCtx.lineTo(pts[i].x, pts[i].y);
    overlayCtx.closePath();
    overlayCtx.stroke();
    best.delete();
  } else {
    lastCorners = null;
  }

  src.delete(); gray.delete(); blur.delete(); edges.delete();
}

async function captureFrame() {
  if (!video || !video.videoWidth) return;
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext('2d').drawImage(video, 0, 0);

  let croppedCanvas = canvas;
  if (cvReady && lastCorners) {
    try {
      croppedCanvas = warpDocument(canvas, lastCorners);
    } catch (e) { /* fall back to uncropped */ }
  }

  const blob = await new Promise(res => croppedCanvas.toBlob(res, 'image/jpeg', 0.92));
  const page = { id: crypto.randomUUID(), blob, originalBlob: blob, rotation: 0, filter: 'original' };
  scannedPages.push(page);
  renderScanned();
  if (onToast) onToast('Page captured');
}

function warpDocument(sourceCanvas, corners) {
  const src = cv.imread(sourceCanvas);
  // order: tl, tr, br, bl
  const ordered = orderCorners(corners);
  const w1 = dist(ordered[0], ordered[1]), w2 = dist(ordered[3], ordered[2]);
  const h1 = dist(ordered[0], ordered[3]), h2 = dist(ordered[1], ordered[2]);
  const w = Math.round(Math.max(w1, w2)), h = Math.round(Math.max(h1, h2));
  const srcPts = cv.matFromArray(4, 1, cv.CV_32FC2, ordered.flatMap(p => [p.x, p.y]));
  const dstPts = cv.matFromArray(4, 1, cv.CV_32FC2, [0,0, w,0, w,h, 0,h]);
  const M = cv.getPerspectiveTransform(srcPts, dstPts);
  const dst = new cv.Mat();
  cv.warpPerspective(src, dst, M, new cv.Size(w, h), cv.INTER_LINEAR, cv.BORDER_CONSTANT, new cv.Scalar());
  const out = document.createElement('canvas');
  out.width = w; out.height = h;
  cv.imshow(out, dst);
  src.delete(); dst.delete(); M.delete(); srcPts.delete(); dstPts.delete();
  return out;
}

function orderCorners(pts) {
  const cx = pts.reduce((s,p) => s + p.x, 0) / 4;
  const cy = pts.reduce((s,p) => s + p.y, 0) / 4;
  const sorted = [...pts].sort((a,b) => Math.atan2(a.y - cy, a.x - cx) - Math.atan2(b.y - cy, b.x - cx));
  // Ensure clockwise starting top-left
  // Rotate so that the point with smallest x+y is first
  let startIdx = 0, minSum = Infinity;
  sorted.forEach((p, i) => { const s = p.x + p.y; if (s < minSum) { minSum = s; startIdx = i; } });
  return [sorted[startIdx], sorted[(startIdx+1)%4], sorted[(startIdx+2)%4], sorted[(startIdx+3)%4]];
}
function dist(a,b) { return Math.hypot(a.x-b.x, a.y-b.y); }

function renderScanned() {
  if (onPagesChanged) onPagesChanged(scannedPages);
  const btn = document.getElementById('scanned-to-pdf-btn');
  if (btn) btn.hidden = scannedPages.length === 0;
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src; s.async = true;
    s.onload = resolve; s.onerror = () => reject(new Error('Failed to load ' + src));
    document.head.appendChild(s);
  });
}