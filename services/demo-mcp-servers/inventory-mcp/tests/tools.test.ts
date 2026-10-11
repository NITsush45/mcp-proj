import { describe, it, expect } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { buildInventoryServer } from '../src/index.js';

async function connected(): Promise<Client> {
  const [ct, st] = InMemoryTransport.createLinkedPair();
  await buildInventoryServer().connect(st);
  const c = new Client({ name: 't', version: '0.0.0' });
  await c.connect(ct);
  return c;
}

describe('inventory-mcp', () => {
  it('looks up and updates stock, errors on unknown SKU', async () => {
    const c = await connected();
    const one = (await c.callTool({ name: 'lookup_item', arguments: { sku: 'TSHIRT-001' } })) as unknown as { content: { text: string }[] };
    expect(JSON.stringify(one)).toContain('Demo T-Shirt');
    const upd = (await c.callTool({ name: 'update_stock', arguments: { sku: 'TSHIRT-001', quantity: 99 } })) as unknown as { content: { text: string }[] };
    expect(JSON.stringify(upd)).toContain('99');
    const miss = (await c.callTool({ name: 'lookup_item', arguments: { sku: 'NOPE-0' } })) as unknown as { isError?: boolean };
    expect(miss.isError).toBe(true);
    await c.close();
  });
});
