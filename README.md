# Urumi — Team MCP Gateway

A central **Model Context Protocol (MCP) gateway** that lets one team talk to many tool-servers through a single, authenticated front door — and an **AI chat agent** that routes plain-language questions to the right server, calls the right tool, and audits every step.

![CI](https://github.com/NITsush45/mcp-proj/actions/workflows/ci.yml/badge.svg)
![License](https://img.shields.io/github/license/NITsush45/mcp-proj)

> **In one sentence:** you ask *“how many orders came in today?”* in the dashboard chat, the gateway figures out which MCP server has that data, calls it safely with credentials the browser never sees, and records exactly what happened.

---

## Why this exists

Teams end up with useful business systems scattered everywhere — an inventory DB, a notes service, a WooCommerce store. Each has its own API, its own credentials, and its own quirks. Wiring an AI assistant to all of them is messy and risky: secrets end up in the browser, nobody can tell what the assistant actually did, and one bad server can break everything.

This platform solves that by putting a **gateway** in the middle:

- **One place to connect tools.** Register an MCP server once; the gateway discovers its tools and namespaces them (`inventory__lookup_item`, `woocommerce__list_orders`, `notes__search`) so nothing collides.
- **Credentials stay server-side.** Team API keys and upstream secrets live only in the gateway/MCP processes. Browsers and MCP clients never receive them.
- **Every call is audited.** Each routed tool call is logged with who/what/result so you always know what the agent did.
- **An agent that “just talks.”** The Chat Agent uses an LLM to pick the right tool from plain English, then streams back an answer plus the tool cards it used.

---

## What it does (feature tour)

| Area | What you get |
| --- | --- |
| **Chat Agent** | Ask business questions in English; the LLM plans tool calls across all servers and answers. Shows the exact tool + arguments + result for transparency. |
| **MCP registry** | Register/health-check upstream MCP servers; the gateway auto-discovers and aggregates their tools under collision-safe names. |
| **AuthN/AuthZ** | Dashboard logins (short-lived **JWT**) and machine **API keys** (hashed, revocable). Role checks (admin vs member) on protected routes. |
| **Audit log** | Every upstream tool call recorded for accountability. |
| **Demo servers** | Three ready MCP servers ship out of the box — **inventory**, **notes**, and **WooCommerce** — so the platform is useful immediately. |

---

## Architecture (high level)

```
                ┌──────────────────────────────┐
                │      React Dashboard (Vite)   │   apps/dashboard  → :5173
                │   Chat · Servers · Keys · …    │
                └───────────────┬──────────────┘
                          HTTPS / JWT
                                ▼
                ┌──────────────────────────────┐
                │        Gateway (Fastify)       │   services/gateway  → :8080
                │  auth · registry · chat agent  │
                │  routing · audit · SSRF guard  │
                └───┬───────────┬───────────┬──┘
                    ▼           ▼           ▼        
              Woo MCP     Notes MCP   Inventory MCP    services/*  → :8081/:8082/:8083
              (REST+Woo)   (SQLite)    (in-memory)
                    │
                    ▼
              WooCommerce store (WordPress + Woo)

        PostgreSQL ── users, keys, servers, audit, notes        :5433
```

**Request path for a chat message:** Dashboard → `POST /api/chat` (JWT) → Gateway chat agent → LLM decides a tool → Gateway routes `server__tool` to the right MCP server over **Streamable HTTP** → MCP server executes (with its own upstream credentials) → result returns to the agent → final answer + audit entry written.

---

## Tech stack

| Layer | Technology | Why it was chosen |
| --- | --- | --- |
| **Frontend** | React + TypeScript + Vite | Fast, typed, instant HMR; tiny bundle; Vite dev proxy keeps same-origin in dev. |
| **Backend / Gateway** | Node.js + Fastify + TypeScript | High-performance, schema-first, easy to secure and test. |
| **MCP servers** | Node.js + `@modelcontextprotocol/sdk` (Streamable HTTP) | Official MCP SDK; stateless HTTP is load-balancer and Ingress friendly. |
| **Chat agent** | Fastify route + `openai`-compatible LLM client | Provider-agnostic (OpenAI / Gemini-compatible endpoints); simple tool-calling loop. |
| **Database** | PostgreSQL (+ SQLite for notes demo) | One system of record for users/keys/servers/audit; lightweight store for the notes service. |
| **Validation** | Zod | Runtime type safety on every request and tool payload. |
| **Testing** | Vitest | Fast unit/integration tests co-located with each service. |
| **Containers** | Docker + Docker Compose | Reproducible local stack (gateway, MCP servers, Postgres, Woo store). |
| **Kubernetes** | Helm charts (nginx → traefik) | Identical charts for local and prod; only `values` change. |
| **CI** | GitHub Actions | Lint + build + test + `helm lint` on every push. |
---

## Repository map (source code)

Everything lives in this monorepo (npm workspaces):

```
urumi-mcp-platform/
├─ apps/dashboard/            # Frontend — React + Vite admin UI
│  └─ src/pages/             # Chat, Servers, Keys, Audit, Team, Settings, Login
├─ services/
│  ├─ gateway/               # Backend + gateway + chat agent (Fastify)
│  │  └─ src/chat/agent.ts   #   the LLM tool-calling loop
│  ├─ woocommerce-mcp/       # WooCommerce MCP server (REST + Basic auth)
│  └─ demo-mcp-servers/
│     ├─ inventory-mcp/      # Demo inventory tools
│     └─ notes-mcp/          # Demo notes tools
├─ infra/helm/               # Helm charts (platform + store), local & prod values
├─ docs/                     # architecture, deployment, threat-model, tradeoffs
├─ smoke/                    # end-to-end scripts + Woo store provisioning
└─ scripts/                  # dev.sh / dev.ps1 one-command startup
```

---

## 1) Local setup (Docker Compose)

The fastest way to run everything. You need **Docker Desktop** and **Node 18+**.

```powershell
# 1. Clone
 git clone https://github.com/NITsush45/mcp-proj.git
 cd mcp-proj

# 2. Secrets — copy the template and fill it in (NEVER commit your real .env)
 copy .env.example .env
 notepad .env            # set LLM_API_KEY, WOOCOMMERCE_* keys, JWT_SECRET, DB password

# 3. Install JS deps (once)
 npm install

# 4. Bring up the backend stack (gateway, 3 MCP servers, Postgres, Woo store)
 docker compose up -d

# 5. Start the dashboard locally (Vite dev server, proxies /api → :8080)
 npm run dev:dashboard     # http://localhost:5173
```

**Then open http://localhost:5173** and log in with the seeded admin from your `.env`
(`SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`).

> The convenience script does the same: `scripts/dev.ps1` (Windows) or `scripts/dev.sh` (Mac/Linux).

### URLs

| Service | URL |
| --- | --- |
| Dashboard (frontend) | http://localhost:5173 |
| Gateway (backend) | http://localhost:8080 |
| Health check | http://localhost:8080/healthz |
| WooCommerce store | http://localhost:8090 |

### Environment variables (`.env`)

See `.env.example` for the full list. The important ones:

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` / `POSTGRES_*` | Postgres connection for users, keys, servers, audit |
| `JWT_SECRET` | Signs dashboard sessions (use ≥32 random chars) |
| `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` | First admin, created on boot |
| `LLM_PROVIDER` / `LLM_MODEL` / `LLM_API_KEY` / `LLM_BASE_URL` | Powers the Chat Agent |
| `WOOCOMMERCE_BASE_URL` / `WOOCOMMERCE_CONSUMER_KEY` / `WOOCOMMERCE_CONSUMER_SECRET` | Woo MCP server credentials |
| `VITE_GATEWAY_URL` | Where the dashboard points (dev) |

---

## 2) Use it: chat, order, and connect a client

### A. Chat Agent (the easy way)

Open the dashboard → **Chat**, and ask in plain English:

- *“how many orders came in today?”* → routes to `woocommerce__list_orders`
- *“list inventory items containing shirt”* → `inventory__search`
- *“search notes for demo”* → `notes__search`

Each reply shows the **tool cards** it used (server → tool → arguments → result), so the
answer is transparent and auditable. The LLM never sees upstream credentials.

### B. Place an order on the demo store

1. Open the store: **http://localhost:8090** (or `store.urumi.local` under K8s).
2. Browse a product → **Add to cart** → **Cart** → **Checkout**.
3. Fill in billing details and place the order (demo store: any details work).
4. Go back to the dashboard → Chat → *“how many orders came in today?”* — your new order shows up.

> The store ships pre-seeded with demo products/orders (`smoke/seed-woo.php`) and a local
> HTTP-auth shim (`smoke/woo-http-auth-shim.php`) so REST keys work over plain HTTP in dev.
> See `smoke/provision-woo-store.sh` to regenerate everything from scratch.

### C. Connect an external MCP client

The gateway speaks the **MCP JSON-RPC protocol over Streamable HTTP** at `/mcp`. Any
MCP-compatible client can authenticate with a team API key and call the aggregated tools.

```powershell
# 1. Log in and grab a JWT (put JSON in a file — PowerShell mangles inline JSON)
#    login.json = {"email":"admin@urumi.local","password":"ChangeMe123!"}
$login  = (curl.exe -s -X POST http://localhost:8080/api/auth/login `
           -H 'Content-Type: application/json' -d '@login.json') | ConvertFrom-Json
$token  = $login.data.token

# 2. List the aggregated, collision-safe tools
curl.exe -s http://localhost:8080/mcp/tools -H "Authorization: Bearer $token"

# 3. Call a tool through the gateway (JSON-RPC)
$body = '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"inventory__lookup_item","arguments":{"sku":"TSHIRT-001"}}}'
curl.exe -s -X POST http://localhost:8080/mcp -H "Authorization: Bearer $token" `
  -H 'Content-Type: application/json' `
  -H 'Accept: application/json, text/event-stream' -d $body
```

A ready-made end-to-end script is included:

```powershell
powershell -ExecutionPolicy Bypass -File smoke/smoke-test.ps1
```

`/mcp` and `/mcp/tools` accept either a **dashboard JWT** or a **team API key**
(`Authorization: Bearer urumi_…`). Full endpoint-by-endpoint walkthrough: `docs/deployment.md`.

---
## 3) Production-like setup on a VPS (k3s + Helm)

The **same Helm charts** power local and production — only the `values` change. No forks.

### Charts & values files

| Path | Role |
| --- | --- |
| `infra/helm/platform/Chart.yaml` | Gateway + dashboard + 3 MCP servers + Postgres + Ingress |
| `infra/helm/platform/values.yaml` | Base values (image tags, ports, resources, ingress hosts) |
| `infra/helm/platform/values-local.yaml` | Local K8s overrides (nginx ingress, `.urumi.local` hosts, no TLS) |
| `infra/helm/platform/values-prod.yaml` | k3s VPS overrides (traefik ingress, real DNS, TLS, `replicas: 2`, `20Gi` storage) |
| `infra/helm/store/…` | The WooCommerce store (WordPress + MariaDB) deployed in its own namespace |

### Deploy to k3s on a VPS

```bash
# 0. On the VPS: install k3s (ships Traefik as its ingress controller)
curl -sfL https://get.k3s.io | sh -

# 1. Build & push images to your registry, then set image tags in values
#    (or use the values-prod.yaml registry/tags). Point real DNS A records
#    dashboard.example.com and gateway.example.com at the VPS.

# 2. Create secrets FIRST (never commit these)
kubectl -n urumi create secret generic gateway-secrets \
  --from-literal=database-url="postgres://urumi:<pw>@postgres:5432/urumi_gateway" \
  --from-literal=jwt-secret="<min-32-chars>" \
  --from-literal=llm-api-key="<key>" --dry-run=client -o yaml | kubectl apply -f -
kubectl -n urumi create secret generic postgres-secrets \
  --from-literal=password="<pw>" --dry-run=client -o yaml | kubectl apply -f -

# 3. Install/upgrade the platform with production values
helm upgrade --install platform ./infra/helm/platform -n urumi --create-namespace \
  -f ./infra/helm/platform/values.yaml -f ./infra/helm/platform/values-prod.yaml

# 4. Deploy the store (own namespace)
helm upgrade --install store ./infra/helm/store -n urumi-store --create-namespace

# 5. Verify
kubectl -n urumi get deploy,svc,ingress
kubectl -n urumi get pods -w
```

Render locally to eyeball what will be applied:

```powershell
npm run helm:template:prod    # same as: helm template ... -f values.yaml -f values-prod.yaml
npm run helm:lint             # lint both charts
```

### What changes for production (a summary)

| Concern | Local | Production (k3s) |
| --- | --- | --- |
| **DNS** | `*.urumi.local` in your hosts file | Real DNS A records → VPS IP (`dashboard.example.com`, `gateway.example.com`) |
| **Ingress** | `ingress-nginx`, `tls: false` | k3s built-in **Traefik**, `tls: true` (cert-manager / your TLS secret) |
| **Replicas** | 1 per service | `replicas: 2` for gateway + dashboard |
| **Storage** | `5Gi` Postgres | `20Gi` Postgres + a real **StorageClass** |
| **Secrets** | `.env` locally | **K8s Secrets** mounted as env — never in images, bundles, or logs |
| **Credentials** | local store keys | same mechanism; Woo keys via Secret, gateway injects its own |

---

## System design & tradeoffs

*(Full version: `docs/system-design-and-tradeoffs.md`.)*

### Architecture choices

- **Gateway pattern** — one front door instead of exposing each MCP server to the browser.
  Keeps credentials, routing, and auditing in a single defensible place.
- **WooCommerce over REST + Basic auth, not a WP plugin** — no PHP to install or maintain,
  works against any hosted Woo store, and credentials stay inside the MCP process. *Tradeoff:*
  you must provision REST keys from wp-admin (automated in `smoke/`).
- **Express/Fastify + Zod** — minimal and well understood, with runtime validation on every
  request and tool payload, which is easy to defend and test.
- **npm workspaces** — gives the monorepo shape with zero extra tooling installs.
- **JWT for dashboards, hashed API keys for machines** — short-lived UX sessions vs
  long-lived, revocable machine credentials are different problems, so they use different tokens.

### How tool aggregation, routing, and failure handling work

- **Aggregation:** on registration/refresh the gateway calls each server’s `tools/list` and
  **namespaces** every tool as `server__tool` (e.g. `inventory__lookup_item`). This makes tool
  names collision-safe across servers and keeps provenance obvious in the audit log.
- **Routing:** a call for `server__tool` is dispatched to that server over **stateless
  Streamable HTTP** (one POST per call). No sticky sessions — correct behind Services/Ingress
  and trivial to scale horizontally.
- **Failure handling:** each upstream call has a timeout (`UPSTREAM_TIMEOUT_MS`). A slow,
  erroring, or unreachable server fails that call and the agent reports it honestly rather than
  inventing data; it never breaks the rest of the conversation or leaks an internal error.
  The agent can also call several tools and still degrade gracefully if one fails.

---
## Threat model

*(Full version: `docs/threat-model.md`.)*

1. **Shared upstream credentials.** One Woo key serves the whole team, so the upstream store
   sees a single identity — it cannot tell which team member did what. Mitigation: **attribution
   happens at the gateway.** Every call is stamped with the calling user in the audit log, so
   “who did this” is answered on our side even though the upstream can’t see it. A member never
   handles the raw credential, so they cannot copy or misuse it outside the platform.

2. **Why client tokens are not passed through.** A team member’s JWT or API key proves *who they
   are to us*; it is meaningless (and dangerous) to hand to an upstream. The gateway authenticates
   the caller, checks their role, then calls the upstream using **the gateway’s own credential**.
   So a compromised upstream never learns a usable client token, and stealing a client token never
   grants direct upstream access.

3. **Untrusted upstreams / tool descriptions.** Tool descriptions are **untrusted strings** that a
   hostile server could try to craft into a prompt-injection against the model. Mitigations: they
   are rendered as plain text (never HTML/eval’d), bounded in length, and the agent treats tool
   output as **data, not instructions**. And critically, **every call still requires gateway auth** —
   a persuasive tool description cannot bypass authorization.

4. **What one team member can do to another.** Role checks are enforced **server-side on every
   protected route**. A `member` cannot list or revoke another user’s keys (queries are scoped by
   `user_id`), cannot register or remove servers (admin-only), and cannot escalate their own role.
   Members can only see and act within their own credentials and the servers the team shares.

5. **SSRF on upstream registration + K8s boundaries.** `validateUpstreamUrl` blocks metadata IPs,
   loopback, RFC1918, non-http(s) schemes, and embedded credentials. In Kubernetes, MCP servers and
   Postgres are **ClusterIP-only** behind NetworkPolicies, and secrets come from K8s Secrets —
   never baked into images or logs.

---

## Testing

```powershell
npm test          # Vitest across all workspaces (gateway + MCP servers)
npm run lint
npm run helm:lint
```

End-to-end (local stack must be running):

```powershell
powershell -ExecutionPolicy Bypass -File smoke/smoke-test.ps1
```

GitHub Actions runs lint + build + test + `helm lint` on every push (`.github/workflows/ci.yml`).

---

## Bonus / stand-out items

A few things beyond the core brief, and where to find them:

| Item | Where |
| --- | --- |
| **Automated local Woo store provisioning** (REST keys, seed data, HTTP-auth shim for local REST over plain HTTP) | `smoke/provision-woo-store.sh`, `smoke/gen-key.php`, `smoke/seed-woo.php`, `smoke/woo-http-auth-shim.php` |
| **One-command dev startup** for the whole stack | `scripts/dev.ps1`, `scripts/dev.sh` |
| **SSRF guard + untrusted-tool-description handling** | `services/gateway/src/security/ssrf.ts`, `src/chat/agent.ts` |
| **Collision-safe tool namespacing** (`server__tool`) across all upstreams | `services/gateway/src/mcp/schema.ts`, `src/registry/sync.ts` |
| **Separate token model** (JWT sessions vs hashed, revocable machine keys) | `services/gateway/src/auth/auth.ts`, `src/security/keys.ts` |
| **Stateless Streamable HTTP transport** (scale behind Ingress, no sticky sessions) | `services/gateway/src/mcp/upstream.ts` |
| **Helm with local + prod values** (nginx→traefik, TLS, storage, replicas) | `infra/helm/platform/values-*.yaml` |

---

## Documentation

- **Architecture** — `docs/architecture.md`
- **Deployment (local K8s + k3s prod)** — `docs/deployment.md`
- **System design & tradeoffs** — `docs/system-design-and-tradeoffs.md`
- **Threat model** — `docs/threat-model.md`
- **Demo script** — `docs/demo-script.md`

---

## License

Released under the **MIT License** — see [`LICENSE`](./LICENSE).