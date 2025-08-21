// 📁 src/api/api.js
const BASE = '';

async function req(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  });

  const raw = await res.text(); // 본문을 항상 먼저 확보
  if (!res.ok) {
    let detail = raw;
    try {
      const j = raw ? JSON.parse(raw) : null;
      if (j) detail = JSON.stringify(j);
    } catch {}
    throw new Error(`${res.status} ${res.statusText}\n${detail || ''}`);
  }

  try {
    return raw ? JSON.parse(raw) : null;
  } catch {
    return raw;
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// NOTE: 로그인 전이므로 user_id는 null로 전송해도 됨
// ──────────────────────────────────────────────────────────────────────────────
export const healthz = () => req('/healthz');

export const createConversation = ({ user_id = null, title }) =>
  req('/v1/conversations', {
    method: 'POST',
    body: JSON.stringify({ user_id: user_id ?? null, title }),
  });

export const getConversation = (id) => req(`/v1/conversations/${id}`);

export const deleteConversationApi = (id) =>
  req(`/v1/conversations/${id}`, { method: 'DELETE' });

export const listMessages = (conversation_id) =>
  req(`/v1/conversations/${conversation_id}/messages`);

export const chat = ({ conversation_id, user_id = null, content }) =>
  req('/v1/chat', {
    method: 'POST',
    body: JSON.stringify({ conversation_id, user_id: user_id ?? null, content }),
  });

export const createImage = ({ conversation_id, prompt }) =>
  req('/v1/images', {
    method: 'POST',
    body: JSON.stringify({ conversation_id, prompt }),
  });
