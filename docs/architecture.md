# Urumi MCP Gateway — Architecture

```
Browser / Claude / Cursor
        │  JWT (dashboard) or urumi_* API key, ONLY to gateway
        ▼
┌──────────────┐   MCP clients (Streamable HTTP)   ┌──────────────────┐
│    GATEWAY   │──────────────────────────────────▶│ woocommerce-mcp  │──▶ Woo REST API ──▶ WordPress/Woo
│ :8080  /mcp  │──────────────────────────────────▶│ notes-mcp        │──▶ in-memory demo store
│ REST + audit │──────────────────────────────────▶│ inventory-mcp    │──▶ in-memory demo store
└──────┬───────┘                                   └──────────────────┘
       │ Postgres (users, upstreams, key hashes, audit)
```

## Why this shape
- **One choke point.** Browsers, the chat agent, and external MCP clients only ever
  talk to the gateway. Upstream MCP Services are ClusterIP-only + NetworkPolicy
  (gateway pods are the sole allowed ingress). Defense in depth: even if someone
  learns an upstream DNS name, packets from other pods are dropped.
- **Collision-safe naming.** Exposed name = `<slug>__<tool>` (e.g.
  `woocommerce__search` vs `notes-mcp__search`). Deterministic, reversible via
  `parseExposedToolName`, preserves the original upstream name internally.
- **Failure isolation.** Per-upstream timeouts (env `UPSTREAM_TIMEOUT_MS`), cached
  tool lists, one slow/unreachable server never blocks healthy ones (Phase 4:
  parallel discovery with `Promise.allSettled`).
- **Credentials.** Team API keys are `urumi_` + 32 random bytes, SHA-256 hashed in
  Postgres (plaintext shown once). Upstream static credentials live in
  `upstream_credentials` / K8s Secrets, never returned by any API or bundled
  into the frontend. Team keys are validated at the gateway and NOT forwarded
  upstream (see threat-model).
- **Audit.** Every `/mcp/call` (success or failure, chat or external client)
  writes server_slug/tool/exposed name/user/duration/outcome to Postgres.
