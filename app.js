import { addFiles, getPages, removePage, rotatePage, movePage, clearPages, renderPreviewList, setOnPageChange } from './image-processing.js';
import { generatePDF } from './pdf.js';
import { openScanner, closeScanner } from './scanner.js';
import { saveDocument, listDocuments, deleteDocument, loadDocument } from './storage.js';

// --- i18n ---
const translations = {
  en: {
    'app.title': 'ScanToPDF', 'app.install': 'Install App',
    'image.heading': 'Images to PDF', 'image.dropHint': 'Drag & drop images here, or',
    'image.addMore': 'Add More Images', 'image.pageCount': 'Pages: {n}', 'image.clearAll': 'Clear All',
    'pdf.pageSize': 'Page Size:', 'pdf.imageSize': 'Image Dimensions',
    'pdf.orientation': 'Orientation:', 'pdf.portrait': 'Portrait', 'pdf.landscape': 'Landscape',
    'pdf.quality': 'Quality:', 'pdf.qualityHigh': 'High', 'pdf.qualityMedium': 'Medium', 'pdf.qualityLow': 'Low',
    'pdf.filename': 'Filename:', 'pdf.generate': 'Generate PDF',
    'camera.heading': 'Scan Document', 'camera.start': 'Start Camera', 'camera.capture': 'Capture',
    'camera.cancel': 'Cancel', 'camera.switch': 'Switch', 'camera.toPdf': 'Convert Scanned Pages to PDF',
    'crop.title': 'Crop & Enhance', 'crop.filter': 'Filter:', 'crop.original': 'Original',
    'crop.enhanced': 'Enhanced', 'crop.grayscale': 'Grayscale', 'crop.bw': 'Black & White',
    'crop.highContrast': 'High Contrast', 'crop.reset': 'Reset', 'crop.apply': 'Apply', 'crop.cancel': 'Cancel',
    'storage.heading': 'Saved Documents', 'storage.namePlaceholder': 'Document name', 'storage.save': 'Save Current',
    'msg.pdfGenerated': 'PDF generated successfully', 'msg.pdfError': 'PDF generation failed',
    'msg.noPages': 'No pages to export', 'msg.saved': 'Document saved', 'msg.saveError': 'Save failed',
    'msg.deleted': 'Document deleted', 'msg.loaded': 'Document loaded', 'msg.clearConfirm': 'Clear all pages?',
    'msg.cameraError': 'Camera access failed', 'msg.cameraUnsupported': 'Camera not supported',
    'msg.autoDetectFallback': 'Auto-detection unavailable, use manual crop',
    'msg.invalidFile': 'Invalid file type', 'msg.processing': 'Processing…',
    'msg.deleteConfirm': 'Delete this saved document?',
  },
  ar: {
    'app.title': 'سكان تو بي دي إف', 'app.install': 'تثبيت التطبيق',
    'image.heading': 'صور إلى PDF', 'image.dropHint': 'اسحب وأفلت الصور هنا، أو',
    'image.addMore': 'إضافة المزيد من الصور', 'image.pageCount': 'الصفحات: {n}', 'image.clearAll': 'مسح الكل',
    'pdf.pageSize': 'حجم الصفحة:', 'pdf.imageSize': 'أبعاد الصورة',
    'pdf.orientation': 'الاتجاه:', 'pdf.portrait': 'عمودي', 'pdf.landscape': 'أفقي',
    'pdf.quality': 'الجودة:', 'pdf.qualityHigh': 'عالية', 'pdf.qualityMedium': 'متوسطة', 'pdf.qualityLow': 'منخفضة',
    'pdf.filename': 'اسم الملف:', 'pdf.generate': 'إنشاء PDF',
    'camera.heading': 'مسح المستند', 'camera.start': 'بدء الكاميرا', 'camera.capture': 'التقاط',
    'camera.cancel': 'إلغاء', 'camera.switch': 'تبديل', 'camera.toPdf': 'تحويل الصفحات الممسوحة إلى PDF',
    'crop.title': 'قص وتحسين', 'crop.filter': 'الفلتر:', 'crop.original': 'أصلي',
    'crop.enhanced': 'محسّن', 'crop.grayscale': 'رمادي', 'crop.bw': 'أبيض وأسود',
    'crop.highContrast': 'تباين عالي', 'crop.reset': 'إعادة تعيين', 'crop.apply': 'تطبيق', 'crop.cancel': 'إلغاء',
    'storage.heading': 'المستندات المحفوظة', 'storage.namePlaceholder': 'اسم المستند', 'storage.save': 'حفظ الحالي',
    'msg.pdfGenerated': 'تم إنشاء PDF بنجاح', 'msg.pdfError': 'فشل إنشاء PDF',
    'msg.noPages': 'لا توجد صفحات للتصدير', 'msg.saved': 'تم حفظ المستند', 'msg.saveError': 'فشل الحفظ',
    'msg.deleted': 'تم حذف المستند', 'msg.loaded': 'تم تحميل المستند', 'msg.clearConfirm': 'مسح جميع الصفحات؟',
    'msg.cameraError': 'فشل الوصول إلى الكاميرا', 'msg.cameraUnsupported': 'الكاميرا غير مدعومة',
    'msg.autoDetectFallback': 'الكشف التلقائي غير متاح، استخدم القص اليدوي',
    'msg.invalidFile': 'نوع ملف غير صالح', 'msg.processing': 'جاري المعالجة…',
    'msg.deleteConfirm': 'حذف هذا المستند المحفوظ؟',
  },
  fr: {
    'app.title': 'ScanToPDF', 'app.install': 'Installer l\'application',
    'image.heading': 'Images en PDF', 'image.dropHint': 'Glissez-déposez des images ici, ou',
    'image.addMore': 'Ajouter des images', 'image.pageCount': 'Pages : {n}', 'image.clearAll': 'Tout effacer',
    'pdf.pageSize': 'Taille de page :', 'pdf.imageSize': 'Dimensions de l\'image',
    'pdf.orientation': 'Orientation :', 'pdf.portrait': 'Portrait', 'pdf.landscape': 'Paysage',
    'pdf.quality': 'Qualité :', 'pdf.qualityHigh': 'Haute', 'pdf.qualityMedium': 'Moyenne', 'pdf.qualityLow': 'Basse',
    'pdf.filename': 'Nom du fichier :', 'pdf.generate': 'Générer le PDF',
    'camera.heading': 'Scanner un document', 'camera.start': 'Démarrer la caméra', 'camera.capture': 'Capturer',
    'camera.cancel': 'Annuler', 'camera.switch': 'Changer', 'camera.toPdf': 'Convertir les pages scannées en PDF',
    'crop.title': 'Recadrer & Améliorer', 'crop.filter': 'Filtre :', 'crop.original': 'Original',
    'crop.enhanced': 'Amélioré', 'crop.grayscale': 'Niveaux de gris', 'crop.bw': 'Noir & Blanc',
    'crop.highContrast': 'Contraste élevé', 'crop.reset': 'Réinitialiser', 'crop.apply': 'Appliquer', 'crop.cancel': 'Annuler',
    'storage.heading': 'Documents sauvegardés', 'storage.namePlaceholder': 'Nom du document', 'storage.save': 'Sauvegarder',
    'msg.pdfGenerated': 'PDF généré avec succès', 'msg.pdfError': 'Échec de la génération du PDF',
    'msg.noPages': 'Aucune page à exporter', 'msg.saved': 'Document sauvegardé', 'msg.saveError': 'Échec de la sauvegarde',
    'msg.deleted': 'Document supprimé', 'msg.loaded': 'Document chargé', 'msg.clearConfirm': 'Effacer toutes les pages ?',
    'msg.cameraError': 'Échec de l\'accès à la caméra', 'msg.cameraUnsupported': 'Caméra non prise en charge',
    'msg.autoDetectFallback': 'Détection auto indisponible, recadrage manuel',
    'msg.invalidFile': 'Type de fichier invalide', 'msg.processing': 'Traitement…',
    'msg.deleteConfirm': 'Supprimer ce document sauvegardé ?',
  }
};

let currentLang = localStorage.getItem('scanLang') || 'en';
function t(key, vars = {}) {
  let s = (translations[currentLang] && translations[currentLang][key]) || key;
  for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, v);
  return s;
}
function applyTranslations() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n;
    el.textContent = t(key);
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    el.placeholder = t(el.dataset.i18nPlaceholder);
  });
  document.documentElement.lang = currentLang;
  document.documentElement.dir = currentLang === 'ar' ? 'rtl' : 'ltr';
  document.getElementById('lang-select').value = currentLang;
}
function showToast(msg, isError = false) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.className = isError ? 'toast error' : 'toast';
  toast.hidden = false;
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => { toast.hidden = true; }, 3500);
}

// --- File handling ---
const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const addMoreBtn = document.getElementById('add-more-btn');

async function handleFiles(files) {
  const valid = Array.from(files).filter(f => /^image\/(jpeg|jpg|png|webp)$/i.test(f.type));
  if (valid.length === 0) { showToast(t('msg.invalidFile'), true); return; }
  try {
    await addFiles(valid);
  } catch (e) { showToast(e.message, true); }
}

dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('dragover'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
dropZone.addEventListener('drop', e => {
  e.preventDefault();
  dropZone.classList.remove('dragover');
  handleFiles(e.dataTransfer.files);
});
fileInput.addEventListener('change', () => { handleFiles(fileInput.files); fileInput.value = ''; });
addMoreBtn.addEventListener('click', () => fileInput.click());

document.getElementById('clear-all-btn').addEventListener('click', () => {
  if (getPages().length === 0) return;
  if (confirm(t('msg.clearConfirm'))) clearPages();
});

// --- PDF generation ---
document.getElementById('generate-pdf-btn').addEventListener('click', async () => {
  const pages = getPages();
  if (pages.length === 0) { showToast(t('msg.noPages'), true); return; }
  const btn = document.getElementById('generate-pdf-btn');
  btn.disabled = true; btn.textContent = t('msg.processing');
  try {
    const pageSize = document.getElementById('page-size').value;
    const orientation = document.getElementById('orientation').value;
    const quality = parseFloat(document.getElementById('quality').value);
    const filename = document.getElementById('pdf-filename').value.trim() || 'document';
    await generatePDF(pages, { pageSize, orientation, quality, filename });
    showToast(t('msg.pdfGenerated'));
  } catch (e) {
    showToast(t('msg.pdfError') + ': ' + e.message, true);
  } finally {
    btn.disabled = false; btn.textContent = t('pdf.generate');
  }
});

// --- Camera ---
const startCamBtn = document.getElementById('start-camera-btn');
const captureBtn = document.getElementById('capture-btn');
const stopCamBtn = document.getElementById('stop-camera-btn');
const switchCamBtn = document.getElementById('switch-camera-btn');
const camContainer = document.getElementById('camera-view-container');

startCamBtn.addEventListener('click', async () => {
  startCamBtn.disabled = true;
  try {
    await openScanner({
      onPagesChanged: (pages) => renderPreviewList('scan-preview-list', pages, { isScanned: true }),
      onToast: showToast,
    });
    camContainer.classList.add('active');
    captureBtn.hidden = false;
    stopCamBtn.hidden = false;
    switchCamBtn.hidden = false;
    startCamBtn.hidden = true;
  } catch (e) {
    showToast(e.message || t('msg.cameraError'), true);
  } finally { startCamBtn.disabled = false; }
});

captureBtn.addEventListener('click', () => { /* handled inside scanner via custom event */ });

stopCamBtn.addEventListener('click', async () => {
  await closeScanner();
  camContainer.classList.remove('active');
  captureBtn.hidden = true;
  stopCamBtn.hidden = true;
  switchCamBtn.hidden = true;
  startCamBtn.hidden = false;
});

switchCamBtn.addEventListener('click', async () => {
  try { await window._switchCamera && window._switchCamera(); } catch (e) { showToast(e.message, true); }
});

document.getElementById('scanned-to-pdf-btn').addEventListener('click', () => {
  document.getElementById('image-section').scrollIntoView({ behavior: 'smooth' });
});

// --- Storage ---
document.getElementById('save-doc-btn').addEventListener('click', async () => {
  const name = document.getElementById('save-doc-name').value.trim();
  if (!name) { showToast('Enter a document name', true); return; }
  const pages = getPages();
  if (pages.length === 0) { showToast(t('msg.noPages'), true); return; }
  try {
    await saveDocument(name, pages);
    showToast(t('msg.saved'));
    await refreshSavedList();
  } catch (e) { showToast(t('msg.saveError') + ': ' + e.message, true); }
});

async function refreshSavedList() {
  const ul = document.getElementById('saved-docs-list');
  ul.innerHTML = '';
  try {
    const docs = await listDocuments();
    for (const doc of docs) {
      const li = document.createElement('li');
      li.innerHTML = `<div class="doc-info"><strong>${escapeHtml(doc.name)}</strong><br><small>${new Date(doc.date).toLocaleString()} — ${doc.pageCount} pages</small></div>`;
      const loadBtn = document.createElement('button');
      loadBtn.textContent = 'Open'; loadBtn.onclick = async () => {
        try {
          const pages = await loadDocument(doc.id);
          clearPages();
          await addFiles(pages.map(p => p.blob));
          showToast(t('msg.loaded'));
        } catch (e) { showToast(e.message, true); }
      };
      const delBtn = document.createElement('button');
      delBtn.textContent = 'Delete'; delBtn.onclick = async () => {
        if (!confirm(t('msg.deleteConfirm'))) return;
        try { await deleteDocument(doc.id); await refreshSavedList(); showToast(t('msg.deleted')); }
        catch (e) { showToast(e.message, true); }
      };
      li.appendChild(loadBtn); li.appendChild(delBtn);
      ul.appendChild(li);
    }
  } catch (e) { /* IndexedDB unavailable, ignore */ }
}
function escapeHtml(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

// --- Language ---
document.getElementById('lang-select').addEventListener('change', e => {
  currentLang = e.target.value;
  localStorage.setItem('scanLang', currentLang);
  applyTranslations();
});

// --- PWA install ---
let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault(); deferredPrompt = e;
  document.getElementById('install-btn').hidden = false;
});
document.getElementById('install-btn').addEventListener('click', async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
  document.getElementById('install-btn').hidden = true;
});

// --- Service worker ---
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('service-worker.js').catch(() => {});
}

// --- Init ---
setOnPageChange((pages) => {
  renderPreviewList('image-preview-list', pages);
  document.getElementById('page-count').textContent = t('image.pageCount', { n: pages.length });
  addMoreBtn.hidden = pages.length === 0;
});
applyTranslations();
refreshSavedList();