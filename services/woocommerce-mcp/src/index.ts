import 'dotenv/config';
// Node 18: SDK transports reference bare `crypto`; ensure WebCrypto exists.
import { webcrypto } from 'node:crypto';
if (!(globalThis as { crypto?: unknown }).crypto) {
  (globalThis as { crypto: unknown }).crypto = webcrypto;
}
import express from 'express';
import helmet from 'helmet';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';
import { WooClient, WooConfigError } from './woocommerce/client.js';
import type { WooPort } from './woocommerce/client.js';

const PORT = Number(process.env.WOO_MCP_PORT ?? 8081);

/**
 * Custom WooCommerce MCP server (written for this project — no off-the-shelf
 * WooCommerce MCP used). Talks to the WooCommerce REST API with server-side
 * credentials; the gateway is its only caller (K8s NetworkPolicy, Phase 7).
 */
export function buildServer(woo: WooPort): McpServer {
  const server = new McpServer({ name: 'woocommerce-mcp', version: '0.1.0' });

  server.tool(
    'list_products',
    'List WooCommerce products with pagination. Use to browse the catalog or verify a product exists.',
    { page: z.number().int().min(1).default(1), per_page: z.number().int().min(1).max(100).default(20), search: z.string().max(200).optional() },
    async ({ page, per_page, search }) => {
      try {
        const items = await woo.get<{ id: number; name: string; price: string; status: string }[]>(
          '/products', { page, per_page, search });
        return { content: [{ type: 'text' as const, text: JSON.stringify(items.map((p) => ({ id: p.id, name: p.name, price: p.price, status: p.status }))) }] };
      } catch (e) { return err(e); }
    },
  );

  server.tool(
    'create_product',
    'Create a WooCommerce product. Requires a name and a numeric price string.',
    { name: z.string().min(1).max(200), price: z.string().regex(/^\d+(\.\d{1,2})?$/, 'price like "19.99"'), status: z.enum(['draft', 'publish']).default('publish') },
    async ({ name, price, status }) => {
      try {
        const p = await woo.post<{ id: number; name: string; price: string }>('/products', { name, regular_price: price, status });
        return { content: [{ type: 'text' as const, text: JSON.stringify({ id: p.id, name: p.name, price: p.price }) }] };
      } catch (e) { return err(e); }
    },
  );

  server.tool(
    'list_orders',
    'List WooCommerce orders, newest first. Filter by status or order date.',
    { page: z.number().int().min(1).default(1), per_page: z.number().int().min(1).max(100).default(20), status: z.string().max(40).optional(), after: z.string().max(40).optional() },
    async ({ page, per_page, status, after }) => {
      try {
        const items = await woo.get<{ id: number; status: string; total: string; date_created: string }[]>(
          '/orders', { page, per_page, status, after });
        return { content: [{ type: 'text' as const, text: JSON.stringify(items.map((o) => ({ id: o.id, status: o.status, total: o.total, date_created: o.date_created }))) }] };
      } catch (e) { return err(e); }
    },
  );

  server.tool(
    'get_order',
    'Fetch one order by ID with line items, totals, and billing info.',
    { id: z.number().int().min(1) },
    async ({ id }) => {
      try {
        const o = await woo.get(`/orders/${id}`);
        return { content: [{ type: 'text' as const, text: JSON.stringify(o) }] };
      } catch (e) { return err(e); }
    },
  );

  server.tool(
    'update_order_status',
    'Change an order status (e.g. pending, processing, completed, cancelled).',
    { id: z.number().int().min(1), status: z.enum(['pending', 'processing', 'on-hold', 'completed', 'cancelled', 'refunded', 'failed']) },
    async ({ id, status }) => {
      try {
        const o = await woo.put<{ id: number; status: string }>(`/orders/${id}`, { status });
        return { content: [{ type: 'text' as const, text: JSON.stringify({ id: o.id, status: o.status }) }] };
      } catch (e) { return err(e); }
    },
  );

  // Same-name collision demo: 'search' also exists on notes-mcp & inventory-mcp.
  server.tool(
    'search',
    'Search WooCommerce products by keyword (collision-demo: also present on notes/inventory).',
    { query: z.string().min(1).max(200) },
    async ({ query }) => {
      try {
        const items = await woo.get<{ id: number; name: string; price: string }[]>('/products', { search: query, per_page: 10 });
        return { content: [{ type: 'text' as const, text: JSON.stringify(items.map((p) => ({ id: p.id, name: p.name, price: p.price }))) }] };
      } catch (e) { return err(e); }
    },
  );

  return server;
}

function err(e: unknown) {
  const msg = e instanceof Error ? e.message : String(e);
  return { content: [{ type: 'text' as const, text: `WooCommerce error: ${msg.slice(0, 300)}` }], isError: true as const };
}

export function startHttp(port = PORT) {
  let woo: WooPort;
  try {
    woo = WooClient.fromEnv();
  } catch (e) {
    if (e instanceof WooConfigError) console.warn(JSON.stringify({ level: 'warn', msg: 'WooCommerce creds missing — tools will report config errors until set' }));
    woo = WooClient.missing();
  }
  const app = express();
  app.use(helmet({ crossOriginResourcePolicy: false }));
  app.use(express.json({ limit: '256kb' }));
  app.get('/healthz', (_req, res) => res.json({ ok: true, service: 'woocommerce-mcp' }));
  app.post('/mcp', async (req, res) => {
    const server = buildServer(woo);
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    res.on('close', () => transport.close().catch(() => undefined));
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  });
  app.listen(port, () => console.log(JSON.stringify({ level: 'info', msg: `woocommerce-mcp on :${port}` })));
  return app;
}

const entry = process.argv[1] ?? '';
if (entry.endsWith('index.js') || entry.endsWith('index.ts')) {
  startHttp();
}

