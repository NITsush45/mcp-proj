export interface WooPort {
  get<T>(path: string, params?: Record<string, unknown>): Promise<T>;
  post<T>(path: string, body: unknown): Promise<T>;
  put<T>(path: string, body: unknown): Promise<T>;
}

export class WooConfigError extends Error {}

/**
 * Why Woo REST API + consumer key/secret (not a WP plugin)?
 * - No PHP/Woo plugin to install or maintain; works against any hosted Woo store.
 * - Credentials stay server-side in this MCP process (K8s Secret), never reach browsers.
 * - Plain HTTPS + Basic auth keeps the failure surface small and testable.
 */
export class WooClient implements WooPort {
  protected constructor(
    private baseUrl: string | null,
    private key: string,
    private secret: string,
    private timeoutMs = 8000,
  ) {}

  static fromEnv(): WooClient {
    const baseUrl = process.env.WOOCOMMERCE_BASE_URL ?? '';
    const key = process.env.WOOCOMMERCE_CONSUMER_KEY ?? '';
    const secret = process.env.WOOCOMMERCE_CONSUMER_SECRET ?? '';
    if (!baseUrl || !key || !secret) throw new WooConfigError('WOOCOMMERCE_BASE_URL/_KEY/_SECRET not set');
    return new WooClient(baseUrl.replace(/\/$/, ''), key, secret);
  }

  static missing(): WooClient {
    return new WooClient(null, '', '');
  }

  /** Test seam: build a client that talks to any WooPort (mock store in tests). */
  static withPort(port: WooPort): WooPort {
    return port;
  }

  private async request<T>(method: string, path: string, body?: unknown, params?: Record<string, unknown>): Promise<T> {
    if (!this.baseUrl) throw new WooConfigError('WooCommerce is not configured (missing credentials)');
    const url = new URL(`/wp-json/wc/v3${path}`, this.baseUrl);
    for (const [k, v] of Object.entries(params ?? {})) {
      if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
    }
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), this.timeoutMs);
    try {
      const r = await fetch(url, {
        method,
        signal: ctrl.signal,
        headers: {
          Authorization: 'Basic ' + Buffer.from(`${this.key}:${this.secret}`).toString('base64'),
          'Content-Type': 'application/json',
        },
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!r.ok) throw new Error(`WooCommerce ${r.status}: ${(await r.text()).slice(0, 300)}`);
      return (await r.json()) as T;
    } catch (e) {
      if ((e as Error).name === 'AbortError') throw new Error('WooCommerce request timed out');
      throw e;
    } finally {
      clearTimeout(t);
    }
  }

  get<T>(path: string, params?: Record<string, unknown>): Promise<T> { return this.request<T>('GET', path, undefined, params); }
  post<T>(path: string, body: unknown): Promise<T> { return this.request<T>('POST', path, body); }
  put<T>(path: string, body: unknown): Promise<T> { return this.request<T>('PUT', path, body); }
}

