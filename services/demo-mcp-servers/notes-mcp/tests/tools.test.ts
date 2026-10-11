import { describe, it, expect } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { buildNotesServer } from '../src/index.js';

async function connected(): Promise<Client> {
  const [ct, st] = InMemoryTransport.createLinkedPair();
  await buildNotesServer().connect(st);
  const c = new Client({ name: 't', version: '0.0.0' });
  await c.connect(ct);
  return c;
}

describe('notes-mcp', () => {
  it('creates then searches notes', async () => {
    const c = await connected();
    const created = (await c.callTool({ name: 'create_note', arguments: { title: 'Interview prep', body: 'defend the gateway design' } })) as unknown as { content: { text: string }[] };
    expect(JSON.stringify(created)).toContain('Interview prep');
    const found = (await c.callTool({ name: 'search', arguments: { query: 'interview' } })) as unknown as { content: { text: string }[] };
    expect(JSON.stringify(found)).toContain('Interview prep');
    await c.close();
  });
});
