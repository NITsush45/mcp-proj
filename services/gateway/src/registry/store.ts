import { toExposedToolName } from '../security/keys.js';
import { discoverTools } from '../mcp/upstream.js';
import type { UpstreamTool } from '../mcp/upstream.js';
import { logger } from '../utils/logger.js';

export type { UpstreamTool };

export interface UpstreamDef {
  slug: string; name: string; url: string; enabled: boolean; authHeader?: string | null;
}
export interface AggregatedTool { exposed: string; slug: string; tool: string; description?: string; inputSchema?: unknown; }
interface Entry {
  def: UpstreamDef;
  status: 'Connected' | 'Unreachable' | 'Disabled';
  tools: UpstreamTool[];
  failures: number;
}

/** Live registry: cached per-upstream discovery, failures isolated per server. */
class LiveRegistry {
  private cache = new Map<string, Entry>();
  private version = 0;

  sync(defs: UpstreamDef[]) {
    let changed = false;
    const seen = new Set(defs.map((d) => d.slug));
    for (const slug of [...this.cache.keys()]) {
      if (!seen.has(slug)) { this.cache.delete(slug); changed = true; }
    }
    for (const def of defs) {
      const cur = this.cache.get(def.slug);
      if (!cur || cur.def.url !== def.url || cur.def.enabled !== def.enabled || cur.def.authHeader !== def.authHeader) {
        this.cache.set(def.slug, { def, status: def.enabled ? 'Unreachable' : 'Disabled', tools: cur?.tools ?? [], failures: 0 });
        changed = true;
      }
    }
    if (changed) this.version++;
  }

  seed(rows: { slug: string; name: string; url: string; enabled: boolean; status: Entry['status']; tools: UpstreamTool[] }[]) {
    this.cache.clear();
    for (const r of rows) {
      this.cache.set(r.slug, { def: { slug: r.slug, name: r.name, url: r.url, enabled: r.enabled }, status: r.status, tools: r.tools, failures: 0 });
    }
    this.version++;
  }

  invalidate() { this.version++; }
  getVersion() { return this.version; }

  status(slug: string): Entry['status'] {
    const e = this.cache.get(slug);
    if (!e) return 'Unreachable';
    if (!e.def.enabled) return 'Disabled';
    return e.status;
  }

  toolsOf(slug: string): UpstreamTool[] {
    const e = this.cache.get(slug);
    if (!e || !e.def.enabled || e.status !== 'Connected') return [];
    return e.tools;
  }

  aggregatedTools(): AggregatedTool[] {
    const out: AggregatedTool[] = [];
    for (const e of this.cache.values()) {
      if (!e.def.enabled || e.status !== 'Connected') continue;
      for (const t of e.tools) {
        out.push({ exposed: toExposedToolName(e.def.slug, t.name), slug: e.def.slug, tool: t.name, description: t.description, inputSchema: t.inputSchema });
      }
    }
    return out;
  }

  findTool(exposed: string): AggregatedTool | null {
    return this.aggregatedTools().find((t) => t.exposed === exposed) ?? null;
  }

  entryOf(slug: string): Entry | null { return this.cache.get(slug) ?? null; }

  snapshots() {
    return [...this.cache.values()].map((e) => ({
      slug: e.def.slug, name: e.def.name, url: e.def.url, enabled: e.def.enabled,
      status: (!e.def.enabled ? 'Disabled' : e.status) as Entry['status'], tools: e.tools,
    }));
  }

  async refreshAll(timeoutMs: number): Promise<void> {
    const jobs = [...this.cache.values()]
      .filter((e) => e.def.enabled)
      .map((e) => discoverTools(e.def.url, e.def.authHeader, timeoutMs)
        .then((tools) => { e.tools = tools; e.status = 'Connected'; e.failures = 0; })
        .catch((err: unknown) => {
          e.failures++;
          e.status = 'Unreachable';
          logger.warn('upstream refresh failed', { slug: e.def.slug, err: String(err).slice(0, 200) });
        }));
    await Promise.allSettled(jobs);
    this.version++;
  }
}

let singleton: LiveRegistry | null = null;
export function getRegistry(): LiveRegistry {
  if (!singleton) singleton = new LiveRegistry();
  return singleton;
}