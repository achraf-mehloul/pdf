const DB_NAME = 'ScanToPDFDB';
const DB_VERSION = 1;
const STORE = 'documents';

function openDB() {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) { reject(new Error('IndexedDB not supported')); return; }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('IndexedDB open failed'));
  });
}

export async function saveDocument(name, pages) {
  const db = await openDB();
  // Convert pages to serializable records with blobs
  const records = pages.map(p => ({
    id: p.id,
    blob: p.blob,
    rotation: p.rotation,
    filter: p.filter,
  }));
  const doc = {
    id: crypto.randomUUID(),
    name,
    date: Date.now(),
    pageCount: records.length,
    pages: records,
  };
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    const req = store.put(doc);
    req.onsuccess = () => { tx.oncomplete = () => { db.close(); resolve(doc); }; };
    req.onerror = () => reject(req.error);
    tx.onerror = () => reject(tx.error);
  });
}

export async function listDocuments() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const store = tx.objectStore(STORE);
    const req = store.getAll();
    req.onsuccess = () => {
      const docs = req.result.map(d => ({ id: d.id, name: d.name, date: d.date, pageCount: d.pageCount }));
      db.close();
      resolve(docs.sort((a,b) => b.date - a.date));
    };
    req.onerror = () => reject(req.error);
  });
}

export async function loadDocument(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const store = tx.objectStore(STORE);
    const req = store.get(id);
    req.onsuccess = () => {
      const doc = req.result;
      db.close();
      if (!doc) { reject(new Error('Document not found')); return; }
      resolve(doc.pages.map(p => ({ blob: p.blob, rotation: p.rotation, filter: p.filter })));
    };
    req.onerror = () => reject(req.error);
  });
}

export async function deleteDocument(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => reject(tx.error);
  });
}