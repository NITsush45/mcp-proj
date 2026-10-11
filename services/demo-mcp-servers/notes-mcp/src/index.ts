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

const PORT = Number(process.env.NOTES_MCP_PORT ?? 8082);

interface Note { id: number; title: string; body: string; createdAt: string; }
const notes: Note[] = [
  { id: 1, title: 'Launch checklist', body: 'Verify checkout, COD enabled, gateway healthy', createdAt: new Date().toISOString() },
  { id: 2, title: 'Demo script', body: 'User A creates product, places order, asks agent', createdAt: new Date().toISOString() },
];
let nextId = 3;

export function buildNotesServer(): McpServer {
  const server = new McpServer({ name: 'notes-mcp', version: '0.1.0' });
  server.tool('search', 'Search notes by keyword across titles and bodies.',
    { query: z.string().min(1).max(200) },
    async ({ query }) => {
      const q = query.toLowerCase();
      const hits = notes.filter((n) => n.title.toLowerCase().includes(q) || n.body.toLowerCase().includes(q));
      return { content: [{ type: 'text' as const, text: JSON.stringify(hits) }] };
    });
  server.tool('create_note', 'Create a note with a title and body.',
    { title: z.string().min(1).max(200), body: z.string().min(1).max(2000) },
    async ({ title, body }) => {
      const note = { id: nextId++, title, body, createdAt: new Date().toISOString() };
      notes.push(note);
      return { content: [{ type: 'text' as const, text: JSON.stringify(note) }] };
    });
  return server;
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('index.js')) {
  const app = express();
  app.use(helmet({ crossOriginResourcePolicy: false }));
  app.use(express.json({ limit: '256kb' }));
  app.get('/healthz', (_req, res) => res.json({ ok: true, service: 'notes-mcp' }));
  app.post('/mcp', async (req, res) => {
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    res.on('close', () => transport.close().catch(() => undefined));
    await buildNotesServer().connect(transport);
    await transport.handleRequest(req, res, req.body);
  });
  app.listen(PORT, () => console.log(JSON.stringify({ level: 'info', msg: `notes-mcp on :${PORT}` })));
}
