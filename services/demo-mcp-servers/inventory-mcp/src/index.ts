import 'dotenv/config';
import { webcrypto } from 'node:crypto';
if (!(globalThis as { crypto?: unknown }).crypto) {
  (globalThis as { crypto: unknown }).crypto = webcrypto;
}
import express from 'express';
import helmet from 'helmet';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';

const PORT = Number(process.env.INVENTORY_MCP_PORT ?? 8083);

interface Item { sku: string; name: string; quantity: number; }
const items = new Map<string, Item>([
  ['TSHIRT-001', { sku: 'TSHIRT-001', name: 'Demo T-Shirt', quantity: 42 }],
  ['MUG-002', { sku: 'MUG-002', name: 'Demo Mug', quantity: 17 }],
]);

export function buildInventoryServer(): McpServer {
  const server = new McpServer({ name: 'inventory-mcp', version: '0.1.0' });
  server.tool('search', 'Search inventory items by name or SKU (collision-demo: also on notes/woocommerce).',
    { query: z.string().min(1).max(200) },
    async ({ query }) => {
      const q = query.toLowerCase();
      const hits = [...items.values()].filter((i) => i.name.toLowerCase().includes(q) || i.sku.toLowerCase().includes(q));
      return { content: [{ type: 'text' as const, text: JSON.stringify(hits) }] };
    });
  server.tool('lookup_item', 'Look up one inventory item by SKU.',
    { sku: z.string().min(1).max(60) },
    async ({ sku }) => {
      const it = items.get(sku.toUpperCase());
      if (!it) return { content: [{ type: 'text' as const, text: `No item with SKU ${sku}` }], isError: true as const };
      return { content: [{ type: 'text' as const, text: JSON.stringify(it) }] };
    });
  server.tool('update_stock', 'Set the stock quantity for an SKU (0 or more).',
    { sku: z.string().min(1).max(60), quantity: z.number().int().min(0).max(1000000) },
    async ({ sku, quantity }) => {
      const it = items.get(sku.toUpperCase());
      if (!it) return { content: [{ type: 'text' as const, text: `No item with SKU ${sku}` }], isError: true as const };
      it.quantity = quantity;
      return { content: [{ type: 'text' as const, text: JSON.stringify(it) }] };
    });
  return server;
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('index.js')) {
  const app = express();
  app.use(helmet({ crossOriginResourcePolicy: false }));
  app.use(express.json({ limit: '256kb' }));
  app.get('/healthz', (_req, res) => res.json({ ok: true, service: 'inventory-mcp' }));
  app.post('/mcp', async (req, res) => {
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    res.on('close', () => transport.close().catch(() => undefined));
    await buildInventoryServer().connect(transport);
    await transport.handleRequest(req, res, req.body);
  });
  app.listen(PORT, () => console.log(JSON.stringify({ level: 'info', msg: `inventory-mcp on :${PORT}` })));
}
