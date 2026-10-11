import { describe, it, expect } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { buildServer } from '../src/index.js';
import type { WooPort } from '../src/woocommerce/client.js';

/** Deterministic fake Woo store — proves tools work without WordPress running. */
function fakeWoo(): WooPort & { products: { id: number; name: string; price: string; status: string }[]; orders: Record<string, unknown>[] } {
  const products = [{ id: 1, name: 'Demo Tee', price: '19.99', status: 'publish' }];
  const orders: Record<string, unknown>[] = [
    { id: 101, status: 'processing', total: '19.99', date_created: new Date().toISOString(), line_items: [{ name: 'Demo Tee' }] },
  ];
  return {
    products,
    orders,
    async get<T>(path: string, params?: Record<string, unknown>): Promise<T> {
      if (path === '/products') {
        const q = String(params?.search ?? '').toLowerCase();
        return products.filter((p) => !q || p.name.toLowerCase().includes(q)) as T;
      }
      if (path === '/orders') return orders as T;
      const m = /^\/orders\/(\d+)$/.exec(path);
      if (m) {
        const o = orders.find((x) => x.id === Number(m[1]));
        if (!o) throw new Error('WooCommerce 404: order not found');
        return o as T;
      }
      throw new Error(`unexpected GET ${path}`);
    },
    async post<T>(path: string, body: unknown): Promise<T> {
      if (path === '/products') {
        const b = body as { name: string; regular_price: string; status: string };
        const p = { id: products.length + 1, name: b.name, price: b.regular_price, status: b.status };
        products.push(p);
        return p as T;
      }
      throw new Error(`unexpected POST ${path}`);
    },
    async put<T>(path: string, body: unknown): Promise<T> {
      const m = /^\/orders\/(\d+)$/.exec(path);
      if (m) {
        const o = orders.find((x) => x.id === Number(m[1]));
        if (!o) throw new Error('WooCommerce 404: order not found');
        Object.assign(o, body);
        return { id: o.id, status: o.status } as T;
      }
      throw new Error(`unexpected PUT ${path}`);
    },
  };
}

async function connectedClient(woo: WooPort): Promise<Client> {
  const [clientT, serverT] = InMemoryTransport.createLinkedPair();
  const server = buildServer(woo);
  await server.connect(serverT);
  const client = new Client({ name: 'test-client', version: '0.0.0' });
  await client.connect(clientT);
  return client;
}

const textOf = (r: { content: { type: string; text?: string }[] }) =>
  r.content.filter((c) => c.type === 'text').map((c) => (c as { text: string }).text).join('\n');

describe('woocommerce-mcp tools (via MCP client, fake store)', () => {
  it('lists products', async () => {
    const client = await connectedClient(fakeWoo());
    const tools = await client.listTools();
    expect(tools.tools.map((t) => t.name).sort()).toEqual(
      ['create_product', 'get_order', 'list_orders', 'list_products', 'search', 'update_order_status']);
    const r = await client.callTool({ name: 'list_products', arguments: {} });
    expect(textOf(r as never)).toContain('Demo Tee');
    await client.close();
  });

  it('creates a product then finds it via search (collision-name tool)', async () => {
    const woo = fakeWoo();
    const client = await connectedClient(woo);
    const created = await client.callTool({ name: 'create_product', arguments: { name: 'Interview Hoodie', price: '49.99' } });
    expect(textOf(created as never)).toContain('Interview Hoodie');
    const found = await client.callTool({ name: 'search', arguments: { query: 'hoodie' } });
    expect(textOf(found as never)).toContain('Interview Hoodie');
    await client.close();
  });

  it('lists orders, gets one order, updates its status', async () => {
    const client = await connectedClient(fakeWoo());
    const list = await client.callTool({ name: 'list_orders', arguments: {} });
    expect(textOf(list as never)).toContain('101');
    const one = await client.callTool({ name: 'get_order', arguments: { id: 101 } });
    expect(textOf(one as never)).toContain('Demo Tee');
    const upd = await client.callTool({ name: 'update_order_status', arguments: { id: 101, status: 'completed' } });
    expect(textOf(upd as never)).toContain('completed');
    await client.close();
  });

  it('returns structured errors (not throws) for unknown orders', async () => {
    const client = await connectedClient(fakeWoo());
    const r = (await client.callTool({ name: 'get_order', arguments: { id: 9999 } })) as unknown as { isError?: boolean };
    expect(r.isError).toBe(true);
    await client.close();
  });

  it('rejects invalid input via zod (bad price, bad id)', async () => {
    const client = await connectedClient(fakeWoo());
    // NOTE: over the MCP protocol, zod failures arrive as isError results, not rejections.
    const badPrice = (await client.callTool({ name: 'create_product', arguments: { name: 'X', price: 'free' } })) as unknown as { isError?: boolean };
    expect(badPrice.isError).toBe(true);
    const badId = (await client.callTool({ name: 'get_order', arguments: { id: -5 } })) as unknown as { isError?: boolean };
    expect(badId.isError).toBe(true);
    await client.close();
  });
});
