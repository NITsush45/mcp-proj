// smoke/mcp-client-check.mjs — Inspector-equivalent check that runs on Node 18.
// Logs in to the gateway, lists tools over Streamable HTTP, and calls one tool.
// Usage (from the urumi-mcp-platform folder):  node smoke/mcp-client-check.mjs
import { webcrypto } from 'node:crypto';
if (!globalThis.crypto) globalThis.crypto = webcrypto;

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const BASE = process.env.GATEWAY_URL ?? 'http://localhost:8080';
const EMAIL = process.env.ADMIN_EMAIL ?? 'admin@urumi.local';
const PASSWORD = process.env.ADMIN_PASSWORD ?? 'ChangeMe123!';

// 1. Login -> JWT (same flow as the dashboard + smoke-test.ps1)
const loginRes = await fetch(`${BASE}/api/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
});
const login = await loginRes.json();
if (!login.ok) throw new Error(`login failed: ${JSON.stringify(login).slice(0, 200)}`);
const token = login.data.token;
console.log(`1. login OK as ${login.data.user.email} (token len ${token.length})`);

// 2. Connect a real MCP client to POST /mcp with the Bearer token
const client = new Client({ name: 'urumi-smoke', version: '1.0.0' });
const transport = new StreamableHTTPClientTransport(new URL(`${BASE}/mcp`), {
  requestInit: { headers: { Authorization: `Bearer ${token}` } },
});
await client.connect(transport);

// 3. tools/list — the full aggregation surface
const { tools } = await client.listTools();
console.log(`2. tools/list OK: ${tools.length} tools`);
for (const t of tools) console.log(`   - ${t.name}`);

// 4. tools/call straight through the gateway to the inventory upstream
const out = await client.callTool({ name: 'inventory__lookup_item', arguments: { sku: 'TSHIRT-001' } });
console.log(`3. tools/call inventory__lookup_item OK: ${JSON.stringify(out).slice(0, 250)}`);

await client.close();
console.log('MCP CLIENT CHECK PASSED');
