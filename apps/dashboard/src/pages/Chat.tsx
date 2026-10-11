import { useState } from 'react';
import { api } from '../api/client.js';

interface ToolCall { exposed: string; slug: string; tool: string; arguments: unknown; result: string; }

export function ChatPage() {
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<{ role: string; text: string; calls?: ToolCall[] }[]>([]);
  const suggestions = ['create a product named Demo Tee at $19.99', 'list inventory items containing "shirt"', 'how many orders came in today?'];
  const send = async () => {
    if (!input.trim() || busy) return;
    setLog((l) => [...l, { role: 'you', text: input }]);
    setInput('');
    setBusy(true);
    try {
      const d = await api.chat(input);
      setLog((l) => [...l, { role: 'agent', text: d.reply, calls: d.toolCalls as ToolCall[] }]);
    } catch (e) { setLog((l) => [...l, { role: 'agent', text: `Error: ${e instanceof Error ? e.message : String(e)}` }]); }
    finally { setBusy(false); }
  };
  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Chat Agent</h2>
          <div className="subtitle">Describe what you need in plain language — the gateway routes the right tools and audits every call.</div>
        </div>
      </div>

      <div className="card">
        <div className="chat-log">
          {log.length === 0 ? (
            <div className="chat-empty">
              <div className="icon">✦</div>
              <p>Ask e.g. “create a product named Demo Tee at $19.99”, then “which orders came in today?”</p>
              <div className="suggest-row">
                {suggestions.map((s) => <button key={s} className="suggest" onClick={() => { setInput(s); }}>{s}</button>)}
              </div>
            </div>
          ) : log.map((m, i) => (
            <div key={i} className={`msg ${m.role === 'user' ? 'user' : 'agent'}`}>
              <div className="who">{m.role}</div>
              <div className="bubble">{m.text}</div>
              {m.calls && m.calls.length > 0 && (
                <div className="tool-calls">
                  {m.calls.map((c, j) => (
                    <details key={j} style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                      <summary>{c.exposed} → {c.slug}</summary>
                      <pre style={{ margin: 0, padding: '8px 12px', fontSize: 11.5, background: '#0f172a', color: '#e2e8f0' }}>{c.result}</pre>
                    </details>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="chat-input-bar">
          <input
            className="input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && send()}
            placeholder="Describe what you need…"
            disabled={busy}
          />
          <button className="btn primary" disabled={busy || !input.trim()} onClick={send}>
            {busy ? 'Thinking…' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  );
}
