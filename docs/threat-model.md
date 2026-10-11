# Threat model

1. **Shared upstream credentials**: one Woo key serves all team members. Mitigation:
   per-user attribution happens at the gateway (audit log); upstream sees one identity.
2. **Team keys NOT forwarded**: a compromised upstream must never learn a team key.
   Gateway authenticates the caller, then uses its own upstream credential.
3. **Malicious upstream / tool descriptions**: descriptions are untrusted strings —
   rendered as text (never HTML), bounded in length, never eval'd; LLM prompts
   treat tool output as data, and every call still needs gateway auth.
4. **Member-vs-member**: server-side role checks on every protected route; a member
   cannot list/revoke another user's keys (queries scoped by `user_id`), cannot
   manage servers (admin-only router).
5. **SSRF on upstream registration**: `validateUpstreamUrl` blocks metadata IP,
   loopback, RFC1918, non-http(s), and embedded creds. Cluster-internal DNS is
   intentionally allowed (upstreams live there). Phase 4+ hardens with DNS-pin +
   redirect checks.
6. **K8s boundaries**: ClusterIP-only upstreams + NetworkPolicies (gateway→MCP,
   gateway→Postgres). Secrets via K8s Secrets, never in images, bundles, or logs.
