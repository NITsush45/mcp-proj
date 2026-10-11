import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express from 'express';
import type { AddressInfo } from 'node:net';
import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { jsonSchemaToShape } from '../src/mcp/schema.js';

describe('jsonSchemaToShape (upstream JSON Schema -> Zod raw shape)', () => {
  // Mirrors the schema inventory-mcp advertises for lookup_item.
  const lookupSchema = {
    $schema: 'http://json-schema.org/draft-07/schema#',
    type: 'object',
    properties: {
      sku: { type: 'string', minLength: 1, maxLength: 60 },
      quantity: { type: 'integer', minimum: 0, maximum: 1000000 },
      mode: { type: 'string', enum: ['strict', 'loose'] },
    },
    required: ['sku'],
    additionalProperties: false,
  };

  it('converts required + optional properties with constraints', () => {
    const shape = jsonSchemaToShape(lookupSchema);
    expect(shape).toBeDefined();
    const obj = z.object(shape!);
    expect(obj.safeParse({ sku: 'TSHIRT-001' }).success).toBe(true);
    expect(obj.safeParse({ sku: 'TSHIRT-001', quantity: 5, mode: 'strict' }).success).toBe(true);
    // required enforced, optionals optional, constraints enforced
    expect(obj.safeParse({}).success).toBe(false);
    expect(obj.safeParse({ sku: '' }).success).toBe(false);
    expect(obj.safeParse({ sku: 'X'.repeat(61) }).success).toBe(false);
    expect(obj.safeParse({ sku: 'A', quantity: -1 }).success).toBe(false);
    expect(obj.safeParse({ sku: 'A', mode: 'nope' }).success).toBe(false);
  });

  it('degrades unknown types safely and rejects schema-less input', () => {
    const shape = jsonSchemaToShape({ type: 'object', properties: { weird: { type: 'wat' } } });
    expect(shape).toBeDefined();
    expect(z.object(shape!).safeParse({ weird: 123 }).success).toBe(true);
    expect(jsonSchemaToShape({ type: 'object' })).toBeUndefined();
    expect(jsonSchemaToShape(undefined)).toBeUndefined();
    expect(jsonSchemaToShape('nonsense')).toBeUndefined();
  });
});

describe('MCP tool registration (regression: JSON Schema crashed POST /mcp)', () => {
  it('registers upstream JSON Schemas without throwing', () => {
    const server = new McpServer({ name: 'urumi-gateway', version: '0.1.0' });
    const tools = [
      { exposed: 'inventory__lookup_item', inputSchema: { type: 'object', properties: { sku: { type: 'string' } }, required: ['sku'] } },
      { exposed: 'notes__search', inputSchema: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] } },
      { exposed: 'woo__list', inputSchema: { type: 'object', properties: {} } },
      { exposed: 'bad__tool', inputSchema: { type: 'object', properties: { x: { type: 'wat', bogus: true } } } },
      { exposed: 'no__schema', inputSchema: undefined },
    ];
    for (const t of tools) {
      // This is exactly what mcp/routes.ts does per tool.
      expect(() => {
        const config: Record<string, unknown> = { description: `Upstream tool ${t.exposed}` };
        const shape = jsonSchemaToShape(t.inputSchema);
        if (shape) config.inputSchema = shape;
        server.registerTool(t.exposed, config as never, (async () => ({ content: [] })) as never);
      }).not.toThrow();
    }
  });
});

describe('POST /mcp end-to-end (JWT + live upstream)', () => {
  let upstream: { url: string; close: () => Promise<void> };
  let baseUrl: string;
  let token: string;
  let httpServer: import('node:http').Server;

  beforeAll(async () => {
    // Env must be in place before createApp() runs loadEnv().
    process.env.JWT_SECRET = 'test-secret-test-secret-test-secret-32';
    process.env.DATABASE_URL = 'postgres://urumi:invalid@127.0.0.1:1/none';

    // Mock upstream that advertises a real JSON Schema input contract.
    const upApp = express();
    upApp.use(express.json({ limit: '256kb' }));
    upApp.post('/mcp', async (req, res) => {
      const s = new McpServer({ name: 'alpha', version: '0.1.0' });
      s.tool('search', 'alpha search', { query: z.string() }, async ({ query }) => ({
        content: [{ type: 'text' as const, text: `alpha:${query}` }],
      }));
      const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
      res.on('close', () => transport.close().catch(() => undefined));
      await s.connect(transport);
      await transport.handleRequest(req, res, req.body);
    });
    const upSrv = await new Promise<import('node:http').Server>((resolve) => {
      const s = upApp.listen(0, '127.0.0.1', () => resolve(s));
    });
    const upPort = (upSrv.address() as AddressInfo).port;
    upstream = { url: `http://127.0.0.1:${upPort}/mcp`, close: () => new Promise((r) => upSrv.close(() => r())) };

    const { createApp } = await import('../src/app.js');
    const { getRegistry } = await import('../src/registry/store.js');
    const { signToken } = await import('../src/auth/auth.js');
    const { app, env } = createApp();
    getRegistry().sync([{ slug: 'alpha', name: 'alpha', url: upstream.url, enabled: true }]);
    token = signToken(env, { id: 'u-test', email: 'test@urumi.local', role: 'admin' });
    httpServer = await new Promise<import('node:http').Server>((resolve) => {
      const s = app.listen(0, '127.0.0.1', () => resolve(s));
    });
    baseUrl = `http://127.0.0.1:${(httpServer.address() as AddressInfo).port}`;
  }, 20000);

  afterAll(async () => {
    await upstream?.close();
    await new Promise<void>((r) => httpServer?.close(() => r()));
  });

  const rpc = (body: Record<string, unknown>, path = '/mcp') =>
    fetch(`${baseUrl}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });

  /** Streamable HTTP may answer with application/json OR an SSE stream — handle both. */
  async function readRpc(res: Response): Promise<Record<string, unknown>> {
    const ct = res.headers.get('content-type') ?? '';
    if (ct.includes('application/json')) return await res.json() as Record<string, unknown>;
    const text = await res.text();
    const dataLines = text.split(/\r?\n/)
      .filter((l) => l.startsWith('data: '))
      .map((l) => l.slice(6));
    for (let i = dataLines.length - 1; i >= 0; i--) {
      try { return JSON.parse(dataLines[i]) as Record<string, unknown>; } catch { /* try older line */ }
    }
    throw new Error(`no JSON payload in response (${ct}): ${text.slice(0, 300)}`);
  }

  it('rejects unauthenticated requests', async () => {
    const res = await fetch(`${baseUrl}/mcp/tools`);
    expect(res.status).toBe(401);
  });

  it('serves tools/list with input schemas (previously crashed the gateway)', async () => {
    const res = await rpc({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} });
    expect(res.status).toBe(200);
    const body = await readRpc(res) as { result?: { tools?: Array<{ name: string; inputSchema?: unknown }> } };
    expect(body.result?.tools?.map((t) => t.name)).toContain('alpha__search');
    const search = body.result!.tools!.find((t) => t.name === 'alpha__search')!;
    expect(search.inputSchema).toMatchObject({ type: 'object' });
  }, 20000);

  it('routes a JSON-RPC tools/call through to the upstream', async () => {
    const res = await rpc({
      jsonrpc: '2.0', id: 2, method: 'tools/call',
      params: { name: 'alpha__search', arguments: { query: 'hi' } },
    });
    expect(res.status).toBe(200);
    const body = await readRpc(res) as { result?: { content?: Array<{ text?: string }> } };
    expect(JSON.stringify(body.result)).toContain('alpha:hi');
  }, 20000);

  it('lists aggregated tools on GET /mcp/tools', async () => {
    const res = await fetch(`${baseUrl}/mcp/tools`, { headers: { Authorization: `Bearer ${token}` } });
    expect(res.status).toBe(200);
    const body = await res.json() as { ok: boolean; data?: Array<{ exposed: string }> };
    expect(body.ok).toBe(true);
    expect(body.data?.map((t) => t.exposed)).toContain('alpha__search');
  }, 20000);
});
