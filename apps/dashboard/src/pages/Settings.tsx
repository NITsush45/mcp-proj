import { useState } from 'react';

const INFO = [
  { label: 'Gateway URL', value: import.meta.env.VITE_GATEWAY_URL ?? '(same origin)' },
  { label: 'Single MCP endpoint', value: '/mcp' },
  { label: 'Auth', value: 'Bearer token (team API key or dashboard JWT)' },
  { label: 'Registers', value: 'upstream MCP servers (server-side only)' },
  { label: 'Tool calls', value: 'audited server-side to POST /api/audit' },
];

export function SettingsPage() {
  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Settings</h2>
          <div className="subtitle">The control plane for the Urumi MCP gateway</div>
        </div>
      </div>

      <div className="card">
        <h3>Gateway info</h3>
        <dl className="kv">
          <dt>Gateway URL</dt>
          <dd><code>{import.meta.env.VITE_GATEWAY_URL ?? '(same origin)'}</code></dd>
          <dt>MCP endpoint</dt>
          <dd><code>/mcp</code> (streamable HTTP)</dd>
          <dt>Auth</dt>
          <dd><code>Authorization: Bearer &lt;team API key or JWT&gt;</code></dd>
        </dl>
      </div>

      <div className="card">
        <h3>Security</h3>
        <ul className="settings-list">
          <li>Team API keys are shown only once at creation — store them in your MCP client.</li>
          <li>Upstream credentials live server-side (Kubernetes secrets) — never in the browser.</li>
          <li>All tool executions are audited to <code>POST /api/audit</code> under the caller.</li>
          <li>Upstreams are optional — start with the three demo MCP servers, add your own later.</li>
        </ul>
      </div>

      <div className="card">
        <h3>Quick start</h3>
        <ul className="settings-list">
          <li><code>POST /api/auth/login</code> with <code>admin@urumi.local</code> / <code>ChangeMe123!</code></li>
          <li><code>POST /mcp</code> — JSON-RPC: <code>&#123; jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} &#125;</code></li>
          <li><code>POST /mcp/call</code> — dashboard-shaped: <code>&#123; tool: 'inventory__lookup_item', arguments: &#123; sku: 'TSHIRT-001' &#125;</code></li>
        </ul>
      </div>
    </div>
  );
}