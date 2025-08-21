const KEYS = {
  user: "haroon.user",
  lastConversationId: "haroon.lastConversationId",
  images: "haroon.images"
};

export function loadUser() {
  try {
    const raw = localStorage.getItem(KEYS.user);
    if (raw) return JSON.parse(raw);
  } catch {}
  const seeded = {
    user_id: `user_${Math.random().toString(36).slice(2, 10)}`,
    name: "Guest",
    avatar: "",
    email: "guest@example.com"
  };
  localStorage.setItem(KEYS.user, JSON.stringify(seeded));
  return seeded;
}

export function saveUser(u) { localStorage.setItem(KEYS.user, JSON.stringify(u)); }
export function setLastCid(id) { localStorage.setItem(KEYS.lastConversationId, id || ""); }
export function getLastCid() { return localStorage.getItem(KEYS.lastConversationId) || ""; }

export function pushImage(item) {
  const list = getImages();
  list.unshift({ ...item, ts: Date.now() });
  localStorage.setItem(KEYS.images, JSON.stringify(list.slice(0, 30)));
}
export function getImages() {
  try { return JSON.parse(localStorage.getItem(KEYS.images) || "[]"); } catch { return []; }
}
export const LS_KEYS = KEYS;