import { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import type { ApiKeyMeta } from '../types/index.js';

export function KeysPage() {
  const [keys, setKeys] = useState<ApiKeyMeta[]>([]);
  const [fresh, setFresh] = useState('');
  const [name, setName] = useState('');
  const [copied, setCopied] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const refresh = () => api.keys().then(setKeys).catch((e) => setErr(e instanceof Error ? e.message : String(e)));
  useEffect(() => { refresh(); }, []);

  const generate = async () => {
    if (busy) return;
    setBusy(true); setErr(''); setCopied(false);
    try {
      const k = await api.createKey(name.trim() || 'default');
      setFresh(k.key);
      setName('');
      refresh();
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(fresh); setCopied(true); }
    catch { setCopied(false); }
  };
  const revoke = async (k: ApiKeyMeta) => {
    if (!window.confirm(`Revoke key "${k.name}" (${k.prefix}…)? Clients using it lose access immediately.`)) return;
    setErr('');
    try { await api.revokeKey(k.id); refresh(); }
    catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>API Keys</h2>
          <div className="subtitle">Team keys for external MCP clients (Claude Code, Cursor, Inspector…)</div>
        </div>
      </div>
      {err && <div className="banner error">{err}</div>}

      {fresh && (
        <div className="key-reveal">
          <div className="label">⚠ Copy now — shown only once</div>
          <code>{fresh}</code>
          <div className="form-row">
            <button className="btn primary sm" onClick={copy}>{copied ? '✓ Copied' : 'Copy key'}</button>
            <button className="btn secondary sm" onClick={() => setFresh('')}>Dismiss</button>
          </div>
          <p style={{ fontSize: 12, color: '#92400e', margin: '10px 0 0' }}>
            Use it as <code>Authorization: Bearer {fresh.slice(0, 14)}…</code> against <code>POST /mcp</code>.
          </p>
        </div>
      )}

      <div className="card">
        <h3>Generate key</h3>
        <div className="form-row">
          <div className="grow">
            <label className="field" htmlFor="key-name">Name (what is this key for?)</label>
            <input id="key-name" className="input" placeholder="e.g. cursor-cli, ci-pipeline" value={name}
              onChange={(e) => setName(e.target.value)} />
          </div>
          <button className="btn primary" disabled={busy} onClick={generate}>{busy ? 'Generating…' : 'Generate key'}</button>
        </div>
      </div>

      <div className="card">
        <h3>Existing keys ({keys.length})</h3>
        {keys.length === 0 ? (
          <div className="empty"><div className="icon">⚿</div>No keys yet — generate one above.</div>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead><tr><th>Name</th><th>Key</th><th>Created</th><th>Status</th><th /></tr></thead>
              <tbody>
                {keys.map((k) => (
                  <tr key={k.id}>
                    <td><b>{k.name}</b></td>
                    <td><code>{k.prefix}…</code></td>
                    <td>{new Date(k.created_at).toLocaleDateString()}</td>
                    <td>
                      <span className={`badge ${k.revoked_at ? 'red' : 'green'}`}>
                        {k.revoked_at ? 'revoked' : 'active'}
                      </span>
                    </td>
                    <td>
                      {!k.revoked_at && <button className="btn danger sm" onClick={() => revoke(k)}>Revoke</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
