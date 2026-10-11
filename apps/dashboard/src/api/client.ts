const BASE = import.meta.env.VITE_GATEWAY_URL ?? '';

function token(): string | null { return localStorage.getItem('urumi_token'); }

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(token() ? { Authorization: `Bearer ${token()}` } : {}), ...(init?.headers ?? {}) },
  });
  const body = await r.json().catch(() => ({}));
  if (!r.ok || body.ok === false) throw new Error(body?.error?.message ?? `Request failed (${r.status})`);
  return body.data as T;
}

export const api = {
  login: (email: string, password: string) =>
    req<{ token: string; user: import('../types/index.js').User }>('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  me: () => req<{ user: import('../types/index.js').User }>('/api/auth/me'),
  servers: () => req<import('../types/index.js').UpstreamServer[]>('/api/servers'),
  upsertServer: (b: Record<string, unknown>) => req<unknown>('/api/servers', { method: 'POST', body: JSON.stringify(b) }),
  updateServer: (id: string, b: Record<string, unknown>) => req<unknown>(`/api/servers/${id}`, { method: 'PATCH', body: JSON.stringify(b) }),
  deleteServer: (id: string) => req<unknown>(`/api/servers/${id}`, { method: 'DELETE' }),
  members: () => req<import('../types/index.js').User[]>('/api/members'),
  addMember: (b: Record<string, unknown>) => req<unknown>('/api/members', { method: 'POST', body: JSON.stringify(b) }),
  keys: () => req<import('../types/index.js').ApiKeyMeta[]>('/api/keys'),
  createKey: (name: string) => req<{ id: string; key: string; warning: string }>('/api/keys', { method: 'POST', body: JSON.stringify({ name }) }),
  revokeKey: (id: string) => req<unknown>(`/api/keys/${id}`, { method: 'DELETE' }),
  audit: (q = '') => req<import('../types/index.js').AuditRow[]>(`/api/audit${q}`),
  tools: () => req<import('../types/index.js').ToolRef[]>('/mcp/tools'),
  chat: (message: string) => req<{ reply: string; toolCalls: unknown[] }>('/api/chat', { method: 'POST', body: JSON.stringify({ message }) }),
};
