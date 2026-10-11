# Urumi MCP Platform

[![CI](https://github.com/NITsush45/mcp-proj/actions/workflows/ci.yml/badge.svg)](https://github.com/NITsush45/mcp-proj/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

> **A team MCP gateway.** One gateway exposes a single `/mcp` endpoint that aggregates multiple Model Context Protocol (MCP) servers behind a unified surface — with a React dashboard, an LLM chat agent, hashed team API keys, and a full audit log. Runs locally on Docker Compose or on Kubernetes via Helm.

Ask the agent *"how many orders came in today?"* in plain English → the gateway routes the question to the right tool, the right MCP server answers it, and every call is audited.

---

## ✨ What it does

| Capability | Description |
|---|---|
| **Unified `/mcp` gateway** | Aggregates `woocommerce-mcp`, `notes-mcp`, and `inventory-mcp` behind one endpoint. Tools are namespaced (`server__tool`) to avoid collisions. |
| **LLM chat agent** | Natural-language interface. The agent picks the right tool, calls it, and answers in plain language — powered by an OpenAI-compatible LLM. |
| **React dashboard** | Admin UI: login, overview, connected servers, team members, API keys, audit log, chat, and settings. |
| **Hashed team API keys** | Keys are stored hashed, never in plaintext. Rotate and revoke from the dashboard. |
| **Audit log** | Every gateway call is recorded (tool, arguments, result, who/when). |
| **Live WooCommerce bridge** | `woocommerce-mcp` talks to a real WooCommerce store over its REST API. |

---

## 🧱 Tech stack

| Layer | Technology |
|---|---|
| **Frontend** | React 18 + TypeScript + Vite |
| **Gateway (backend)** | Node.js + TypeScript + Fastify |
| **MCP servers** | Node.js + TypeScript (Model Context Protocol SDK) |
| **Database** | PostgreSQL |
| **LLM** | OpenAI-compatible API (e.g. Gemini / OpenAI) |
| **Cloud / runtime** | Docker + Docker Compose (local) · Kubernetes + Helm (k3s / cluster) |
| **Testing** | Vitest (unit) · smoke scripts (end-to-end) |

---

## 🚀 Quickstart

### Prerequisites
- [Docker Desktop](https://www.docker.com/) (for the full stack)
- Node.js 20+ (to run the dashboard or services locally)

### 1) Configure secrets (local only)
```powershell
cd urumi-mcp-platform
Copy-Item .env.example .env   # then edit .env and fill in your LLM + Woo keys
```
> 🔐 **`.env` is never committed.** It is git-ignored by design. Only `.env.example` (with placeholder values) is tracked.

### 2) Run the backend stack (Docker)
```powershell
docker compose up -d            # gateway :8080 + 3 MCP servers + Postgres :5433
```

### 3) Run the dashboard (frontend)
```powershell
npm install
npm run dev:dashboard           # http://localhost:5173  (proxies /api -> :8080)
```

Open **http://localhost:5173** and log in with the seeded admin account.

### URLs
| Service | URL |
|---|---|
| Dashboard (frontend) | http://localhost:5173 |
| Gateway API (backend) | http://localhost:8080 |
| Health check | http://localhost:8080/healthz |

---

## 💬 Try it
In the dashboard **Chat** tab (or via API), ask:
- *"how many orders came in today?"* → routes to `woocommerce__list_orders`
- *"list inventory items containing shirt"* → routes to `inventory__search`
- *"add a note saying demo recorded today"* → routes to `notes__create_note`

The response shows the plain-language answer **and** the exact tool call the gateway routed to.

---

## 📂 Repo map
- `services/gateway` — auth, MCP registry/proxy, REST API, audit, LLM chat agent
- `services/woocommerce-mcp` — WooCommerce REST bridge (list orders, products, etc.)
- `services/demo-mcp-servers/{notes,inventory}-mcp` — demo upstream servers
- `apps/dashboard` — React + TypeScript admin UI
- `infra/helm/{platform,store}` — Helm charts for Kubernetes
- `docs/` — architecture, system design & tradeoffs, threat model, deployment, demo script
- `smoke/` — end-to-end smoke tests + WooCommerce provisioning helpers

---

## 🧪 Tests
```powershell
# Unit tests (all workspaces)
npm run test

# End-to-end smoke test against a running stack
powershell -ExecutionPolicy Bypass -File smoke/smoke-test.ps1
```

---

## ☸️ Kubernetes deployment
See [`docs/deployment.md`](docs/deployment.md) for Helm-based deploys to a local
Kubernetes (k3s) cluster. Charts live under `infra/helm/platform` (the gateway stack)
and `infra/helm/store` (the WooCommerce store).

For a scripted walkthrough of the full demo, see [`docs/demo-script.md`](docs/demo-script.md).

---

## 📄 Documentation
- [Architecture](docs/architecture.md)
- [System design & tradeoffs](docs/system-design-and-tradeoffs.md)
- [Threat model](docs/threat-model.md)
- [Deployment (Kubernetes)](docs/deployment.md)
- [Demo script](docs/demo-script.md)

---

## 🔐 Security notes
- Secrets live **only** in your local `.env`, which is git-ignored.
- `.env.example` ships with **placeholder** values — copy it and fill in your own.
- Team API keys are stored **hashed**. Never commit real credentials.
