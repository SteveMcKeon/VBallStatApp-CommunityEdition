export const VIDEO_TIMES_KEY = "videoTimes";

const readAll = () => {
  try {
    return JSON.parse(localStorage.getItem(VIDEO_TIMES_KEY)) || {};
  } catch {
    return {};
  }
};

export const getVideoTime = (id) => {
  if (!id) return 0;
  const all = readAll();
  const raw = all[id];
  const n = typeof raw === "number" ? raw : parseFloat(raw);
  return Number.isFinite(n) ? n : 0;
};

export const setVideoTime = (id, time) => {
  if (!id) return;
  const all = readAll();
  all[id] = time;
  localStorage.setItem(VIDEO_TIMES_KEY, JSON.stringify(all));
};

export const clearVideoTime = (id) => {
  if (!id) return;
  const all = readAll();
  delete all[id];
  localStorage.setItem(VIDEO_TIMES_KEY, JSON.stringify(all));
};
