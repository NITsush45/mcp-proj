import { describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';
import { AddressInfo } from 'node:net';
import { getRegistry } from '../src/registry/store.js';
import { callUpstreamTool, discoverTools } from '../src/mcp/upstream.js';

/** Spin up a real Streamable-HTTP MCP server on a random port. */
async function startMockMcp(name: string, build: (s: McpServer) => void): Promise<{ url: string; close: () => Promise<void> }> {
  const app = express();
  app.use(express.json({ limit: '256kb' }));
  app.get('/healthz', (_req, res) => res.json({ ok: true }));
  app.post('/mcp', async (req, res) => {
    const server = new McpServer({ name, version: '0.1.0' });
    build(server);
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    res.on('close', () => transport.close().catch(() => undefined));
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  });
  const srv = await new Promise<import('node:http').Server>((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const port = (srv.address() as AddressInfo).port;
  return { url: `http://127.0.0.1:${port}/mcp`, close: () => new Promise((r) => srv.close(() => r())) };
}

function alphaBuild(s: McpServer) {
  s.tool('search', 'alpha search', { query: z.string() }, async ({ query }) => ({
    content: [{ type: 'text' as const, text: `alpha:${query}` }],
  }));
  s.tool('alpha_only', 'alpha only tool', {}, async () => ({
    content: [{ type: 'text' as const, text: 'alpha-only-ok' }],
  }));
}

function betaBuild(s: McpServer) {
  s.tool('search', 'beta search', { query: z.string() }, async ({ query }) => ({
    content: [{ type: 'text' as const, text: `beta:${query}` }],
  }));
}

describe('upstream discovery + routing', () => {
  beforeEach(() => { getRegistry().seed([]); });

  it('discovers tools from live upstreams', async () => {
    const a = await startMockMcp('alpha', alphaBuild);
    try {
      const tools = await discoverTools(a.url, null, 5000);
      expect(tools.map((t) => t.name).sort()).toEqual(['alpha_only', 'search']);
    } finally { await a.close(); }
  });

  it('aggregates with collision-safe names and isolates dead servers', async () => {
    const a = await startMockMcp('alpha', alphaBuild);
    const b = await startMockMcp('beta', betaBuild);
    try {
      getRegistry().sync([
        { slug: 'alpha', name: 'alpha', url: a.url, enabled: true },
        { slug: 'beta', name: 'beta', url: b.url, enabled: true },
        { slug: 'ghost', name: 'ghost', url: 'http://127.0.0.1:1/mcp', enabled: true },
      ]);
      await getRegistry().refreshAll(4000);
      const agg = getRegistry().aggregatedTools().map((t) => t.exposed).sort();
      // both 'search' tools present under distinct names …
      expect(agg).toContain('alpha__search');
      expect(agg).toContain('beta__search');
      expect(agg).toContain('alpha__alpha_only');
      // … and the dead server contributed nothing but is marked Unreachable
      expect(getRegistry().status('ghost')).toBe('Unreachable');
      expect(getRegistry().status('alpha')).toBe('Connected');
      expect(agg.filter((x) => x.startsWith('ghost__'))).toEqual([]);
    } finally { await a.close(); await b.close(); }
  });

  it('routes each namespaced call to the correct upstream', async () => {
    const a = await startMockMcp('alpha', alphaBuild);
    const b = await startMockMcp('beta', betaBuild);
    try {
      const ra = (await callUpstreamTool(a.url, null, 'search', { query: 'hi' }, 4000)) as { content: { text: string }[] };
      const rb = (await callUpstreamTool(b.url, null, 'search', { query: 'hi' }, 4000)) as { content: { text: string }[] };
      expect(JSON.stringify(ra)).toContain('alpha:hi');
      expect(JSON.stringify(rb)).toContain('beta:hi');
    } finally { await a.close(); await b.close(); }
  });

  it('disabled servers disappear from aggregation', async () => {
    const a = await startMockMcp('alpha', alphaBuild);
    try {
      getRegistry().sync([{ slug: 'alpha', name: 'alpha', url: a.url, enabled: true }]);
      await getRegistry().refreshAll(4000);
      expect(getRegistry().findTool('alpha__search')).not.toBeNull();
      getRegistry().sync([{ slug: 'alpha', name: 'alpha', url: a.url, enabled: false }]);
      expect(getRegistry().findTool('alpha__search')).toBeNull();
      expect(getRegistry().status('alpha')).toBe('Disabled');
    } finally { await a.close(); }
  });
});
