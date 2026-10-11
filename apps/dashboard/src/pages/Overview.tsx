import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import type { UpstreamServer, AuditRow } from '../types/index.js';

const STATUS_BADGE: Record<string, string> = { Connected: 'green', Unreachable: 'red', Disabled: 'gray' };

export function OverviewPage() {
  const [servers, setServers] = useState<UpstreamServer[]>([]);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    Promise.all([api.servers(), api.audit('?limit=10')])
      .then(([s, a]) => { setServers(s); setAudit(a); })
      .catch((e) => setErr(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, []);
  const enabled = servers.filter((s) => s.enabled);
  const toolCount = servers.reduce((n, s) => n + s.tools.length, 0);
  const failures = audit.filter((a) => a.outcome === 'error').length;
  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Overview</h2>
          <div className="subtitle">Gateway health at a glance</div>
        </div>
        <Link className="btn secondary" to="/audit">View audit logs →</Link>
      </div>
      {err && <div className="banner error">{err}</div>}
      {loading ? (
        <div className="card"><div className="spinner" /> Loading metrics…</div>
      ) : (
        <>
          <div className="stat-grid">
            <div className="stat accent">
              <div className="label">Enabled servers</div>
              <div className="value">{enabled.length}</div>
              <div className="hint">of {servers.length} registered</div>
            </div>
            <div className="stat accent">
              <div className="label">Aggregated tools</div>
              <div className="value">{toolCount}</div>
              <div className="hint">behind one /mcp endpoint</div>
            </div>
            <div className="stat">
              <div className="label">Recent calls</div>
              <div className="value">{audit.length}</div>
              <div className="hint">last 10 audit rows</div>
            </div>
            <div className={`stat ${failures ? 'bad' : 'good'}`}>
              <div className="label">Recent failures</div>
              <div className="value">{failures}</div>
              <div className="hint">in the same window</div>
            </div>
          </div>
          <div className="card">
            <div className="card-title-row">
              <h3>Server health</h3>
              <Link className="btn secondary sm" to="/servers">Manage</Link>
            </div>
            {servers.length === 0 ? (
              <div className="empty">
                <div className="icon">⬡</div>
                No upstream servers yet — <Link to="/servers">register one</Link>.
              </div>
            ) : (
              <div className="table-wrap">
                <table className="data">
                  <thead>
                    <tr><th>Name</th><th>Status</th><th>Tools</th><th>URL</th></tr>
                  </thead>
                  <tbody>
                    {servers.map((s) => (
                      <tr key={s.id}>
                        <td>
                          <b>{s.name}</b>
                          <div style={{ color: 'var(--muted)', fontSize: 12 }}>{s.slug}</div>
                        </td>
                        <td><span className={`badge ${STATUS_BADGE[s.status] ?? 'gray'}`}>{s.status}</span></td>
                        <td>{s.tools.length}</td>
                        <td><code>{s.url}</code></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          <div className="card">
            <h3>Recent activity</h3>
            {audit.length === 0 ? (
              <div className="empty">
                <div className="icon">≣</div>
                No tool calls yet — try the <Link to="/chat">Chat Agent</Link> or call a tool from an MCP client.
              </div>
            ) : (
              <div className="table-wrap">
                <table className="data">
                  <thead>
                    <tr><th>Time</th><th>Tool</th><th>Outcome</th><th>ms</th></tr>
                  </thead>
                  <tbody>
                    {audit.map((a) => (
                      <tr key={a.id}>
                        <td>{new Date(a.created_at).toLocaleTimeString()}</td>
                        <td><code>{a.exposed_tool}</code></td>
                        <td><span className={`badge ${a.outcome === 'success' ? 'green' : 'red'}`}>{a.outcome}</span></td>
                        <td>{a.duration_ms}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
