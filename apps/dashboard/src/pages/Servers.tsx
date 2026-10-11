import { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import type { UpstreamServer } from '../types/index.js';

const STATUS_BADGE: Record<string, string> = { Connected: 'green', Unreachable: 'red', Disabled: 'gray' };

export function ServersPage() {
  const [servers, setServers] = useState<UpstreamServer[]>([]);
  const [err, setErr] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ name: '', url: 'http://woocommerce-mcp:8081/mcp', description: '' });
  const refresh = () => api.servers().then(setServers).catch((e) => setErr(e instanceof Error ? e.message : String(e)));
  useEffect(() => { refresh(); }, []);

  const fail = (e: unknown) => setErr(e instanceof Error ? e.message : String(e));
  const add = async () => {
    if (!form.name.trim() || busy) return;
    setBusy(true); setErr(''); setNotice('');
    try {
      await api.upsertServer(form);
      setNotice(`Server "${form.name}" saved — tool discovery refreshed.`);
      setForm({ name: '', url: 'http://woocommerce-mcp:8081/mcp', description: '' });
      refresh();
    } catch (e) { fail(e); } finally { setBusy(false); }
  };
  const toggle = async (s: UpstreamServer) => {
    setErr(''); setNotice('');
    try { await api.updateServer(s.id, { enabled: !s.enabled }); refresh(); }
    catch (e) { fail(e); }
  };
  const remove = async (s: UpstreamServer) => {
    if (!window.confirm(`Delete "${s.name}" (${s.slug})? Its tools disappear from /mcp immediately.`)) return;
    setErr(''); setNotice('');
    try { await api.deleteServer(s.id); refresh(); }
    catch (e) { fail(e); }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>MCP Servers</h2>
          <div className="subtitle">Upstream MCP servers aggregated behind the gateway</div>
        </div>
      </div>
      {err && <div className="banner error">{err}</div>}
      {notice && <div className="banner success">{notice}</div>}

      <div className="card">
        <h3>Register upstream</h3>
        <div className="form-grid">
          <div>
            <label className="field" htmlFor="srv-name">Name</label>
            <input id="srv-name" className="input" placeholder="e.g. billing" value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <label className="field" htmlFor="srv-url">Streamable HTTP URL</label>
            <input id="srv-url" className="input" placeholder="http://host:port/mcp" value={form.url}
              onChange={(e) => setForm({ ...form, url: e.target.value })} />
          </div>
          <div>
            <label className="field" htmlFor="srv-desc">Description (optional)</label>
            <input id="srv-desc" className="input" placeholder="what this server provides" value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <button className="btn primary" disabled={busy || !form.name.trim()} onClick={add}>
            {busy ? 'Saving…' : 'Add server'}
          </button>
        </div>
      </div>

      {servers.length === 0 ? (
        <div className="card"><div className="empty"><div className="icon">⬡</div>No servers registered yet.</div></div>
      ) : servers.map((s) => (
        <div key={s.id} className="card server-card">
          <div className="head">
            <div>
              <span className="name">{s.name}</span>
              <span className="slug">{s.slug}</span>
              <div style={{ marginTop: 6 }}>
                <span className={`badge ${STATUS_BADGE[s.status] ?? 'gray'}`}>{s.status}</span>
                {!s.enabled && <span className="badge gray" style={{ marginLeft: 6 }}>excluded from /mcp</span>}
              </div>
              <div className="url">{s.url}</div>
            </div>
            <div className="form-row">
              <button className="btn secondary sm" onClick={() => toggle(s)}>
                {s.enabled ? 'Disable' : 'Enable'}
              </button>
              <button className="btn danger sm" onClick={() => remove(s)}>Remove</button>
            </div>
          </div>
          {s.description && <p style={{ color: 'var(--muted)', fontSize: 13, margin: '10px 0 0' }}>{s.description}</p>}
          {s.tools.length > 0 ? (
            <div className="tool-chips">
              {s.tools.map((t) => <span key={t.name} className="tool-chip" title={t.description ?? ''}>{t.name}</span>)}
            </div>
          ) : (
            <div className="tool-chips"><span className="tool-chip muted">no tools discovered{!s.enabled ? ' (disabled)' : ''}</span></div>
          )}
        </div>
      ))}
    </div>
  );
}
