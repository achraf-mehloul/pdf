import { renderPageToBlob } from './image-processing.js';

const PAGE_DIMS = {
  a4: { w: 595.28, h: 841.89 },     // points
  a3: { w: 841.89, h: 1190.55 },
  letter: { w: 612, h: 792 },
};

export async function generatePDF(pages, { pageSize, orientation, quality, filename }) {
  const { jsPDF } = window.jspdf;
  let doc = null;
  const sanitized = sanitizeFilename(filename);

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    const blob = await renderPageToBlob(page, quality);
    const dataUrl = await blobToDataURL(blob);
    const imgProps = await getImageDimensions(dataUrl);

    if (pageSize === 'image') {
      // Use image dimensions in points (1px = 1pt approximation)
      const w = imgProps.width, h = imgProps.height;
      if (!doc) doc = new jsPDF({ unit: 'pt', format: [w, h], orientation: w > h ? 'l' : 'p' });
      else doc.addPage([w, h], w > h ? 'l' : 'p');
      doc.addImage(dataUrl, 'JPEG', 0, 0, w, h);
    } else {
      let { w: pw, h: ph } = PAGE_DIMS[pageSize] || PAGE_DIMS.a4;
      if (orientation === 'landscape') [pw, ph] = [ph, pw];
      if (!doc) doc = new jsPDF({ unit: 'pt', format: [pw, ph], orientation });
      else doc.addPage([pw, ph], orientation);
      // Fit image inside page with margins
      const margin = 20;
      const availW = pw - margin * 2, availH = ph - margin * 2;
      const ratio = Math.min(availW / imgProps.width, availH / imgProps.height);
      const drawW = imgProps.width * ratio, drawH = imgProps.height * ratio;
      const x = (pw - drawW) / 2, y = (ph - drawH) / 2;
      doc.addImage(dataUrl, 'JPEG', x, y, drawW, drawH);
    }
  }

  if (!doc) throw new Error('No pages processed');
  doc.save(sanitized + '.pdf');
}

function blobToDataURL(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}

function getImageDimensions(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.width, height: img.height });
    img.onerror = reject;
    img.src = dataUrl;
  });
}

function sanitizeFilename(name) {
  return (name || 'document').replace(/[\\/:*?"<>|]/g, '_').trim() || 'document';
}