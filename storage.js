/* Local-first persistence. No network access. IndexedDB stores app state and media blobs. */
(function (root) {
  'use strict';
  const DB_NAME = 'mychef-ai-local';
  const DB_VERSION = 1;
  const STATE_KEY = 'main-state';
  const LEGACY_KEY = 'mychef-ai-v1';

  function openDatabase() {
    return new Promise((resolve, reject) => {
      if (!root.indexedDB) return reject(new Error('IndexedDB is unavailable'));
      const request = root.indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('state')) db.createObjectStore('state');
        if (!db.objectStoreNames.contains('media')) db.createObjectStore('media', { keyPath: 'id' });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('Could not open local database'));
      request.onblocked = () => reject(new Error('Local database upgrade is blocked by another tab'));
    });
  }

  async function getState(db) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction('state', 'readonly');
      const request = tx.objectStore('state').get(STATE_KEY);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async function saveState(db, state) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction('state', 'readwrite');
      tx.objectStore('state').put(state, STATE_KEY);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error('Save aborted'));
    });
  }

  async function init(defaultState) {
    let db;
    try {
      db = await openDatabase();
      let state = await getState(db);
      if (!state) {
        // One-time migration from the previous localStorage format.
        try {
          const legacy = root.localStorage && root.localStorage.getItem(LEGACY_KEY);
          if (legacy) {
            const parsed = JSON.parse(legacy);
            if (parsed && Array.isArray(parsed.recipes) && parsed.profile) state = parsed;
          }
        } catch (_) { /* Invalid legacy data is not imported. */ }
        if (!state) state = defaultState;
        await saveState(db, state);
        // Remove the legacy copy only after the IndexedDB transaction completed.
        try { if (root.localStorage) root.localStorage.removeItem(LEGACY_KEY); } catch (_) {}
      }
      return { state, backend: 'indexeddb', db };
    } catch (error) {
      let state = defaultState;
      try {
        const legacy = root.localStorage && root.localStorage.getItem(LEGACY_KEY);
        const parsed = legacy && JSON.parse(legacy);
        if (parsed && Array.isArray(parsed.recipes) && parsed.profile) state = parsed;
      } catch (_) { /* Use defaults. */ }
      return { state, backend: 'localstorage-fallback', db: null, warning: String(error && error.message || error) };
    }
  }

  async function save(context, state) {
    if (context && context.db) return saveState(context.db, state);
    try { root.localStorage.setItem(LEGACY_KEY, JSON.stringify(state)); return true; }
    catch (error) { throw error; }
  }

  async function putMedia(context, item) {
    if (!context || !context.db) throw new Error('אחסון תמונות דורש IndexedDB פעיל.');
    return new Promise((resolve, reject) => {
      const tx = context.db.transaction('media', 'readwrite');
      tx.objectStore('media').put(item);
      tx.oncomplete = () => resolve(item.id);
      tx.onerror = () => reject(tx.error);
    });
  }

  async function getMedia(context, id) {
    if (!context || !context.db) return null;
    return new Promise((resolve, reject) => {
      const tx = context.db.transaction('media', 'readonly');
      const request = tx.objectStore('media').get(id);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async function deleteMedia(context, id) {
    if (!context || !context.db) return;
    return new Promise((resolve, reject) => {
      const tx = context.db.transaction('media', 'readwrite');
      tx.objectStore('media').delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  root.MyChefStorage = { init, save, putMedia, getMedia, deleteMedia };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.MyChefStorage;
})(globalThis);
