import { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import type { AuditRow } from '../types/index.js';

export function AuditPage() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [tool, setTool] = useState('');
  const [outcome, setOutcome] = useState<'all' | 'success' | 'error'>('all');
  const [err, setErr] = useState('');
  useEffect(() => { api.audit().then(setRows).catch((e) => setErr(e instanceof Error ? e.message : String(e))); }, []);
  const filtered = rows.filter((r) =>
    (outcome === 'all' || r.outcome === outcome) &&
    (!tool || r.exposed_tool.includes(tool) || r.tool_name.includes(tool) || r.server_slug.includes(tool)));
  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Audit Logs</h2>
          <div className="subtitle">Every tool call through the gateway — by user, keyed or via chat</div>
        </div>
      </div>
      {err && <div className="banner error">{err}</div>}

      <div className="card">
        <div className="form-row">
          <div className="grow">
            <label className="field" htmlFor="audit-filter">Filter</label>
            <input id="audit-filter" className="input" placeholder="tool or server name…" value={tool}
              onChange={(e) => setTool(e.target.value)} />
          </div>
          <div style={{ minWidth: 160 }}>
            <label className="field" htmlFor="audit-outcome">Outcome</label>
            <select id="audit-outcome" className="input" value={outcome}
              onChange={(e) => setOutcome(e.target.value as 'all' | 'success' | 'error')}>
              <option value="all">all</option>
              <option value="success">success</option>
              <option value="error">error</option>
            </select>
          </div>
        </div>
      </div>

      <div className="card">
        <h3>{filtered.length} record{filtered.length === 1 ? '' : 's'}</h3>
        {filtered.length === 0 ? (
          <div className="empty"><div className="icon">≣</div>No audit records yet — call a tool from the chat or an MCP client.</div>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr><th>Time</th><th>User</th><th>Server</th><th>Tool</th><th>Outcome</th><th>ms</th></tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id}>
                    <td style={{ whiteSpace: 'nowrap' }}>{new Date(r.created_at).toLocaleString()}</td>
                    <td>{r.user_email ?? <span style={{ color: 'var(--muted)' }}>—</span>}</td>
                    <td>{r.server_slug}</td>
                    <td>
                      <code>{r.exposed_tool}</code>
                      {r.error_summary && (
                        <div style={{ color: 'var(--danger)', fontSize: 11.5, marginTop: 3 }} title={r.error_summary}>
                          {r.error_summary.length > 90 ? `${r.error_summary.slice(0, 90)}…` : r.error_summary}
                        </div>
                      )}
                    </td>
                    <td><span className={`badge ${r.outcome === 'success' ? 'green' : 'red'}`}>{r.outcome}</span></td>
                    <td>{r.duration_ms}</td>
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
