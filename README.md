# Urumi MCP Platform

[![CI](https://github.com/NITsush45/mcp-proj/actions/workflows/ci.yml/badge.svg)](https://github.com/NITsush45/mcp-proj/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue.svg)](https://www.typescriptlang.org/)

> **One gateway. Many MCP servers. One place to ask questions in plain English.**

---

## 🌟 What is this, in one paragraph?

**Urumi** is a single, secured front door — a **gateway** — that sits in front of many backends that speak the [Model Context Protocol](https://modelcontextprotocol.io/) (MCP). Instead of every app and every AI agent having to know the address and secret credentials of each backend, **everyone talks to one gateway**. The gateway figures out which backend should answer a question, forwards the request, returns the answer, and writes down a record of everything that happened.

> **Concrete example:** You type *“how many orders came in today?”* into a chat box. The gateway routes that to the **WooCommerce** tool, the store answers it, and the whole call is recorded in the audit log — with no store credentials ever reaching the browser.

---

## 🤔 The problem it solves

In a real company, business data is scattered across many systems:

- a **WooCommerce store** (orders, products),
- a **notes** app,
- an **inventory** database,
- …and more, added over time.

Each one is a different API with its own address, quirks, and **secret keys**. Without a gateway, every application or AI assistant that wants this data must:

1. **Know the address** of every backend,
2. **Hold a copy of every backend's secret credentials**, and
3. **Be re-wired** every time a backend is added, moved, or rotated.

This is fragile and dangerous. One leaked key — in any one of those apps — is a full breach, and there is no single place to see *who asked for what, and when*.

**Urumi puts one gateway in front of everything.** Apps and agents talk only to the gateway:

- The gateway **holds the real credentials** on the server side (keys never reach a browser or a client app).
- It **routes** each request to the correct backend based on the tool name.
- It **audits** every call — caller, tool, arguments, and outcome.

Add or remove a backend, and client apps don't change. Rotate a key in one place, done.

---

## ⚙️ How it works

```
                    ┌─────────────────────────────────────────────┐
   Browser / AI     │                 GATEWAY (:8080)             │
   client           │  REST auth  •  /mcp proxy  •  audit log     │
   (you, Claude…)   └───────┬─────────────────────┬───────────────┘
        │  login (JWT)      │ resolves tool owner  │ writes to DB
        │  or urumi_ key    ▼                      ▼
        │            ┌──────────────┐        ┌──────────────┐
        └──────────▶ │  MCP servers │        │  PostgreSQL  │
                     └──────┬───────┘        └──────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        ▼                   ▼                   ▼
  woocommerce-mcp       notes-mcp          inventory-mcp
  (Woo REST API)        (demo data)        (demo data)
```

**The flow, step by step:**

1. A person (or an AI client) sends a request to the gateway's single `/mcp` surface, authenticated with a **login token (JWT)** or a **team API key**.
2. The gateway reads the **tool name** — for example `woocommerce__list_orders` — and knows exactly which upstream server owns it.
3. It forwards the call to that server over HTTP (the MCP *Streamable HTTP* transport).
4. The upstream server does the real work (e.g. queries the live WooCommerce store) and returns a result.
5. The result travels back through the gateway to the caller.
6. **Every call is written to the audit log**: who called, which tool, what arguments, and whether it succeeded.

### Collision-safe tool names (`<server>__<tool>`)

Different servers can — and in this project **do** — expose tools with the *same* name. All three servers here have a `search` tool. To keep them from colliding, the gateway **namespaces** every tool as `<server>__<tool>`:

| Upstream server | Port | Tools it exposes (as `<server>__<tool>`) |
|---|---|---|
| `woocommerce-mcp` | 8081 | `woocommerce__list_orders`, `woocommerce__list_products`, `woocommerce__create_product`, `woocommerce__get_order`, `woocommerce__update_order_status`, `woocommerce__search` |
| `notes-mcp` | 8082 | `notes__search`, `notes__create_note` |
| `inventory-mcp` | 8083 | `inventory__search`, `inventory__lookup_item`, `inventory__update_stock` |

So `woocommerce__search`, `notes__search`, and `inventory__search` never clash, even though upstream they are all called `search`.

---

## 🧱 Tech stack

| Layer | What it's built with | Why |
|---|---|---|
| **Dashboard (frontend)** | React 18, TypeScript, Vite, React Router, plain CSS | Fast dev server, small bundle, easy to read |
| **Gateway (backend)** | Node.js, TypeScript, Fastify, PostgreSQL (`pg`), JWT | Single secured entry point + persistent audit log |
| **MCP servers** | TypeScript, the MCP SDK over *Streamable HTTP* | Each backend speaks one standard protocol |
| **Chat agent** | The gateway calls an LLM (OpenAI-compatible) that *picks tools* | Plain-English → the right tool, automatically |
| **Infra** | Docker Compose (local) + Helm charts (Kubernetes) | Runs identically on a laptop or a cluster |
| **Tests** | Vitest | Unit + end-to-end smoke tests |

> The LLM is accessed through an **OpenAI-compatible** endpoint (`LLM_BASE_URL`), so it works with OpenAI, a local model server, or a Gemini-compatible gateway — you just change env vars.

---

## 🚀 Quickstart (run it in ~3 steps)

**Prerequisites:** Node.js ≥ 18, Docker Desktop.

**1. Set your secrets** — copy the example env file and fill in your LLM key (and WooCommerce keys if you want live store data):

```bash
cp .env.example .env
# edit .env: set LLM_API_KEY (required). Everything else has safe dev defaults.
```

> 🔒 **`.env` is git-ignored on purpose.** Only `.env.example` (placeholders) is committed, so real secrets never reach GitHub.

**2. Start the backend** (gateway + all MCP servers + Postgres, all in Docker):

```bash
docker compose up -d --build
```

**3. Start the frontend** (runs on your machine, proxies API calls to the gateway):

```bash
npm install
npm run dev:dashboard
```

Then open **http://localhost:5173** and log in with the seeded admin:

```
Email:    admin@urumi.local
Password: ChangeMe123!
```

### Where everything lives

| Piece | URL |
|---|---|
| Dashboard UI | http://localhost:5173 |
| Gateway API | http://localhost:8080 |
| WooCommerce MCP | http://localhost:8081 |
| Notes MCP | http://localhost:8082 |
| Inventory MCP | http://localhost:8083 |
| PostgreSQL | localhost:5433 |

### Useful commands

| Command | What it does |
|---|---|
| `npm run dev:dashboard` | Start the frontend dev server (:5173) |
| `npm run dev:gateway` | Run the gateway locally, outside Docker (:8080) |
| `npm test` | Run all unit + integration tests |
| `npm run build` | Build every workspace |
| `docker compose logs -f gateway` | Tail gateway logs |

---


## 💬 Try it — ask the chat agent

Open the **Chat** page and type a plain-English question. The agent picks the right tool and shows the call it made.

| You ask | Tool it routes to | What happens |
|---|---|---|
| “how many orders came in today?” | `woocommerce__list_orders` | Queries the live store |
| “list inventory items containing shirt” | `inventory__search` | Searches demo inventory |
| “add a note saying demo recorded today” | `notes__create_note` | Writes a demo note |
| “search notes for demo” | `notes__search` | Finds matching notes |

Every chat reply also shows the **tool card** — exactly which tool ran and what it returned — so nothing is a black box.

---

## 🗺 Repository map

```
urumi-mcp-platform/
├── apps/
│   └── dashboard/          # React + Vite admin UI (chat, servers, audit, keys, team)
├── services/
│   ├── gateway/            # Fastify backend: auth, /mcp proxy, LLM chat agent, audit
│   ├── woocommerce-mcp/    # Talks to a real WooCommerce store via REST
│   └── demo-mcp-servers/   # notes-mcp + inventory-mcp (self-contained demo data)
├── infra/
│   └── helm/               # Helm charts: platform (gateway+servers) and store (Woo)
├── docs/                   # architecture, deployment, threat model, demo script
├── smoke/                  # End-to-end scripts + WooCommerce provisioning helpers
└── docker-compose.yml      # Local dev stack
```

---

## 🧪 Tests

```bash
npm test
```

Tests cover the gateway (auth, MCP routing, security like SSRF guards) and each MCP server's tools, plus a Vitest setup. For a full live check, see the `smoke/` scripts.

---

## ☸️ Deploy to Kubernetes

Helm charts live in `infra/helm/`:

```bash
# preview what would be deployed (local values)
npm run helm:template:local

# or production values
npm run helm:template:prod

# lint the charts
npm run helm:lint
```

- **`infra/helm/platform`** → gateway, dashboard, MCP servers, PostgreSQL, ingress, secrets
- **`infra/helm/store`** → the WooCommerce demo store

Values files (`values.yaml`, `values-local.yaml`, `values-prod.yaml`) let you switch environments without editing the charts.

---

## 🔐 Security notes

- **Secrets stay server-side.** Store and LLM credentials live only in the gateway / MCP containers — they never reach the browser.
- **`.env` is never committed.** Only the sanitized `.env.example` is in git; a `.gitignore` blocks `.env`, `node_modules/`, and build output.
- **SSRF protection.** The gateway validates upstream URLs before proxying, so it can't be tricked into hitting internal services.
- **Full audit trail.** Every tool call is recorded: who called it, which tool, the arguments, and the result.
- See **`docs/threat-model.md`** for the full security analysis.

---

## 📚 Documentation

| Doc | What's inside |
|---|---|
| `docs/architecture.md` | How the pieces fit together |
| `docs/deployment.md` | Local + Kubernetes deployment |
| `docs/system-design-and-tradeoffs.md` | Design decisions and why |
| `docs/threat-model.md` | Security model and mitigations |
| `docs/demo-script.md` | A guided walkthrough for demos |

---

<p align="center">
  Built for the Urumi AI FDE Internship · a single secured gateway in front of many MCP servers.
</p>

