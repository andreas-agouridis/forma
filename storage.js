'use strict';

window.FormaStore = (() => {
  const DRAFT_KEY = 'forma.draft.v2';
  let connection;

  function readDraft() {
    try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null'); }
    catch { return null; }
  }
  function saveDraft(draft) {
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify(draft)); return true; }
    catch { return false; }
  }
  function database() {
    if (connection) return connection;
    connection = new Promise((resolve, reject) => {
      if (!window.indexedDB) return reject(new Error('Storage unavailable'));
      let expired = false;
      const timer = setTimeout(() => { expired = true; reject(new Error('Storage is blocked')); }, 2500);
      const request = indexedDB.open('forma-creations', 1);
      request.onupgradeneeded = () => { request.result.createObjectStore('images', { keyPath: 'id' }); };
      request.onerror = () => { clearTimeout(timer); reject(request.error); };
      request.onsuccess = () => {
        clearTimeout(timer);
        if (expired) { request.result.close(); return; }
        const db = request.result;
        db.onversionchange = () => db.close();
        resolve(db);
      };
    });
    return connection;
  }
  async function list() {
    const db = await database();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('images', 'readonly');
      const request = transaction.objectStore('images').getAll();
      transaction.oncomplete = () => resolve(request.result.sort((a, b) => b.createdAt - a.createdAt).slice(0, 12));
      transaction.onabort = transaction.onerror = () => reject(transaction.error || new Error('Storage unavailable'));
    });
  }
  async function save(item) {
    const db = await database();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('images', 'readwrite');
      const store = transaction.objectStore('images');
      const { url, ...record } = item;
      store.put(record);
      const request = store.getAll();
      request.onsuccess = () => request.result.sort((a, b) => b.createdAt - a.createdAt).slice(12).forEach((entry) => store.delete(entry.id));
      transaction.oncomplete = resolve;
      transaction.onabort = transaction.onerror = () => reject(transaction.error || new Error('Storage unavailable'));
    });
  }
  async function clear() {
    const db = await database();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('images', 'readwrite');
      transaction.objectStore('images').clear();
      transaction.oncomplete = resolve;
      transaction.onabort = transaction.onerror = () => reject(transaction.error || new Error('Storage unavailable'));
    });
  }
  return { readDraft, saveDraft, list, save, clear };
})();
