const DB = 'vball-local';
const STORE = 'filelinks';

function openDB() {
  return new Promise((res, rej) => {
    const req = indexedDB.open(DB, 4);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
}
async function idbGet(key) {
  const db = await openDB();
  return await new Promise((res, rej) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(key);
    req.onsuccess = () => res(req.result ?? null);
    req.onerror = () => rej(req.error);
    tx.oncomplete = () => db.close();
  });
}
async function idbPut(key, val) {
  const db = await openDB();
  await new Promise((res, rej) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(val, key);
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
  db.close();
}
async function idbDel(key) {
  const db = await openDB();
  await new Promise((res, rej) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(key);
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
  db.close();
}

async function ensureReadPerm(handle) {
  const q = await handle.queryPermission?.({ mode: 'read' });
  if (q === 'granted') return true;
  const granted = (await handle.requestPermission?.({ mode: 'read' })) === 'granted';
  return granted;
}

// =========================== KEYED BY {team_id}-{title} ===========================
export const makeGameKey = (teamId, title) => `${teamId}-${title}`;

export async function storeFileHandleForKey(key, fileHandle) {
  // stored under "key:<teamId>-<title>"
  await idbPut(`key:${key}`, fileHandle);
}

export async function hasFileHandleForKey(key) {
  return !!(await idbGet(`key:${key}`));
}

export async function urlForKey(key) {
  const handle = await idbGet(`key:${key}`);
  if (!handle) throw new Error('no-handle');
  if (!(await ensureReadPerm(handle))) throw new Error('permission-denied');
  const file = await handle.getFile();
  return URL.createObjectURL(file); // blob: URL for <video>
}

export async function relinkForKey(key, suggestedName = 'video.mp4') {
  if (!window.showOpenFilePicker) throw new Error('picker-unavailable');
  const [fh] = await window.showOpenFilePicker({
    types: [{ description: 'MP4 Videos', accept: { 'video/mp4': ['.mp4'] } }],
    excludeAcceptAllOption: false,
    multiple: false,
    suggestedName,
  });
  await storeFileHandleForKey(key, fh);
  return fh;
}

export async function removeFileHandleForKey(key) {
  await idbDel(`key:${key}`);
}

// =========================== BACKWARD COMPAT (by gameId) ===========================
// These mirror the old API so existing imports won't explode while you migrate.
// They store under "game:<id>"

export async function storeFileHandleForGame(gameId, fileHandle) {
  await idbPut(`game:${gameId}`, fileHandle);
}

export async function hasFileHandleForGame(gameId) {
  return !!(await idbGet(`game:${gameId}`));
}

export async function urlForGame(gameId) {
  const handle = await idbGet(`game:${gameId}`);
  if (!handle) throw new Error('no-handle');
  if (!(await ensureReadPerm(handle))) throw new Error('permission-denied');
  const file = await handle.getFile();
  return URL.createObjectURL(file);
}

export async function relinkForGame(gameId, suggestedName = 'video.mp4') {
  if (!window.showOpenFilePicker) throw new Error('picker-unavailable');
  const [fh] = await window.showOpenFilePicker({
    types: [{ description: 'MP4 Videos', accept: { 'video/mp4': ['.mp4'] } }],
    excludeAcceptAllOption: false,
    multiple: false,
    suggestedName,
  });
  await idbPut(`game:${gameId}`, fh);
  return fh;
}

export async function removeFileHandleForGame(gameId) {
  await idbDel(`game:${gameId}`);
}

// =========================== OPFS (cross-browser cache) ===========================
// We mirror a copy of the picked file into OPFS so Firefox/Safari can play it later,
// even though they don’t support persistent OS file handles.

function safeKey(key) {
  return String(key).replace(/[^a-z0-9._-]/gi, '_');
}

async function getVideosDir(create = true) {
  if (!('storage' in navigator) || !navigator.storage.getDirectory) {
    throw new Error('opfs-unsupported');
  }
  const root = await navigator.storage.getDirectory();
  const videos = await root.getDirectoryHandle('videos', { create });
  return videos;
}

/** Copy a File into OPFS under /videos/<safeKey>/source */
export async function cacheOPFSForKey(key, file) {
  const videos = await getVideosDir(true);
  const dir = await videos.getDirectoryHandle(safeKey(key), { create: true });
  const fh = await dir.getFileHandle('source', { create: true });
  const ws = await fh.createWritable();
  await file.stream().pipeTo(ws);
}

/** Return a blob: URL for the OPFS copy if it exists */
export async function opfsUrlForKey(key) {
  const videos = await getVideosDir(false);
  const dir = await videos.getDirectoryHandle(safeKey(key), { create: false }).catch(() => null);
  if (!dir) throw new Error('opfs-miss');
  const fh = await dir.getFileHandle('source', { create: false }).catch(() => null);
  if (!fh) throw new Error('opfs-miss');
  const file = await fh.getFile();
  return URL.createObjectURL(file);
}

export async function hasOPFSForKey(key) {
  try { await opfsUrlForKey(key); return true; } catch { return false; }
}

export async function removeOPFSForKey(key) {
  const videos = await getVideosDir(false);
  const name = safeKey(key);
  await videos.removeEntry(name, { recursive: true }).catch(() => {});
}
