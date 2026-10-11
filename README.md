# Urumi MCP Platform — Team MCP Gateway on Kubernetes

WooCommerce hosting + one gateway MCP endpoint (`/mcp`) aggregating
**woocommerce-mcp**, **notes-mcp**, **inventory-mcp**. Dashboard (React) + chat agent
+ hashed team API keys + audit log. Helm-deployed to local K8s and k3s with the
same charts.

## Quickstart (Windows PowerShell)
```powershell
cd urumi-mcp-platform
Copy-Item .env.example .env   # fill secrets locally, never commit .env
npm install
npm run test --workspace=services/gateway
npm run dev --workspace=services/gateway   # :8080 (needs Postgres or use docker)
```

## Verify a running stack (Docker or K8s)
```powershell
docker compose up -d --build                 # gateway :8080 + 3 MCP servers + Postgres :5433
powershell -ExecutionPolicy Bypass -File smoke/smoke-test.ps1
```
The smoke test walks health → login → `/mcp/tools` → JSON-RPC `tools/list` and
`tools/call inventory__lookup_item` through the gateway to a live upstream.
For the Kubernetes path see `docs/deployment.md`.

## Repo map
- `services/gateway` — auth, registry, `/mcp` aggregation, REST, audit, chat stub
- `services/woocommerce-mcp` — custom Woo REST bridge (5 required tools + `search`)
- `services/demo-mcp-servers/{notes,inventory}-mcp` — demo upstreams (share `search` name → collision demo)
- `apps/dashboard` — React+TS admin UI (login, overview, servers, team, keys, audit, chat, settings)
- `infra/helm/{platform,store}` — Helm charts + local/prod values
- `docs/` — architecture, tradeoffs, threat model, deployment, demo script

## Phases
- [x] Phase 1+2: scaffold (this commit) — installs, builds, unit tests
- [ ] Phase 3: store deploy + Woo tool verification
- [ ] Phase 4: live gateway aggregation/routing
- [ ] Phase 5: DB-backed registry/audit hardening
- [ ] Phase 6: dashboard polish + LLM agent loop
- [ ] Phase 7: K8s deploy + failure drills
- [ ] Phase 8: verification + submission

See `docs/deployment.md` for K8s steps and `docs/demo-script.md` for the DoD walkthrough.
