import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

export interface UpstreamTool { name: string; description?: string; inputSchema?: unknown; }

export function routeError(code: string, message: string): Error & { code: string } {
  return Object.assign(new Error(message), { code });
}

export function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  let t: ReturnType<typeof setTimeout>;
  return Promise.race([
    p,
    new Promise<never>((_, rej) => { t = setTimeout(() => rej(new Error(label)), ms); }),
  ]).finally(() => clearTimeout(t!));
}

export function isConnError(e: unknown): boolean {
  const m = String((e as Error)?.message ?? e);
  return /fetch failed|ECONNREFUSED|ENOTFOUND|timed out|timeout|network/i.test(m);
}

function transportFor(url: string, authHeader?: string | null): StreamableHTTPClientTransport {
  const headers: Record<string, string> = {};
  // Team API keys are validated at the gateway and NEVER forwarded upstream.
  // Only the upstream's own provisioned credential (if any) is attached.
  if (authHeader) headers['Authorization'] = authHeader;
  return new StreamableHTTPClientTransport(new URL(url), { requestInit: { headers } });
}

/** Single discovery round against one upstream, with a hard timeout. */
export async function discoverTools(url: string, authHeader: string | null | undefined, timeoutMs: number): Promise<UpstreamTool[]> {
  const client = new Client({ name: 'urumi-gateway', version: '0.1.0' });
  const transport = transportFor(url, authHeader);
  try {
    await withTimeout(client.connect(transport), timeoutMs, 'upstream connect timed out');
    const res = await withTimeout(client.listTools(), timeoutMs, 'upstream listTools timed out');
    return (res.tools ?? []).map((t) => ({
      name: t.name,
      // Upstream descriptions are untrusted: bound length, rendered as plain text only.
      description: typeof t.description === 'string' ? t.description.slice(0, 500) : undefined,
      inputSchema: t.inputSchema,
    }));
  } finally {
    await client.close().catch(() => undefined);
  }
}

/** Route one tool call to its upstream over a short-lived MCP client. */
export async function callUpstreamTool(
  url: string, authHeader: string | null | undefined,
  tool: string, args: Record<string, unknown>, timeoutMs: number,
): Promise<unknown> {
  const client = new Client({ name: 'urumi-gateway', version: '0.1.0' });
  const transport = transportFor(url, authHeader);
  try {
    await withTimeout(client.connect(transport), timeoutMs, 'upstream connect timed out');
    return await withTimeout(
      client.callTool({ name: tool, arguments: args }),
      timeoutMs, 'upstream tool call timed out');
  } finally {
    await client.close().catch(() => undefined);
  }
}
