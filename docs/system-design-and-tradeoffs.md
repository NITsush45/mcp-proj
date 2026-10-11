# System design & tradeoffs

- **WooCommerce via REST + Basic auth** (not a WP plugin): no PHP to maintain,
  works against any hosted Woo store, creds stay in the MCP server process via
  K8s Secret. Tradeoff: needs Woo REST keys provisioned from wp-admin.
- **npm workspaces** (not pnpm): pnpm wasn't installed on this Windows box;
  npm workspaces give the same monorepo shape with zero extra installs.
  `pnpm-workspace.yaml` is kept so `pnpm install` also works.
- **Express + zod**: minimal, well-known, easy to defend in interview.
- **JWT (dashboard) + hashed API keys (MCP clients)**: separate concerns —
  short-lived UX sessions vs long-lived revocable machine creds.
- **Stateless Streamable HTTP** (`sessionIdGenerator: undefined`): one POST per
  call, no sticky sessions — correct behind K8s Services/Ingress.
- **Local → prod**: identical charts; only values change (hosts, ingress class
  nginx→traefik, replicas, storage, TLS). No chart forks.
