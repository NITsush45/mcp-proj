# Local Kubernetes deployment

## Hosts file (Windows, run Notepad as Admin)
```
127.0.0.1 dashboard.urumi.local gateway.urumi.local store.urumi.local
```

## Install ingress-nginx, deploy
```powershell
helm upgrade --install platform ./infra/helm/platform -n urumi --create-namespace `
  -f ./infra/helm/platform/values.yaml -f ./infra/helm/platform/values-local.yaml
helm upgrade --install store ./infra/helm/store -n urumi-store --create-namespace
kubectl -n urumi get pods
```

## Secrets (create BEFORE first use — never commit)
```powershell
kubectl -n urumi create secret generic gateway-secrets `
  --from-literal=database-url='postgres://urumi:<pw>@postgres:5432/urumi_gateway' `
  --from-literal=jwt-secret='<min-32-chars>' `
  --from-literal=llm-api-key='<key>' --dry-run=client -o yaml | kubectl apply -f -
kubectl -n urumi create secret generic postgres-secrets --from-literal=password='<pw>' --dry-run=client -o yaml | kubectl apply -f -
```

## k3s prod: same charts, `values-prod.yaml`, traefik class, real DNS + TLS secret.
See README for full steps.

## Verify the install
```powershell
kubectl -n urumi get deploy,svc,ingress
kubectl -n urumi get pods -w          # all containers Running / Ready
kubectl -n urumi logs deploy/gateway --tail=20   # expect: gateway listening on :8080
```

## Smoke test (after ingress is up; host `gateway.urumi.local` from the hosts file)
Put the JSON bodies in files first — inline quoting in PowerShell mangles JSON:

`login.json`
```json
{"email":"admin@urumi.local","password":"<seed-admin-password>"}
```

```powershell
$base = 'http://gateway.urumi.local'   # or http://localhost with port-forward
# 1. health
curl.exe -s "$base/healthz"                    # {"ok":true,"service":"gateway"}
curl.exe -s "$base/readyz"                     # {"ok":true,"db":"up",...}
# 2. login -> JWT
$login = (curl.exe -s -X POST "$base/api/auth/login" -H 'Content-Type: application/json' -d "@login.json") | ConvertFrom-Json
$token = $login.data.token
# 3. aggregated tool list (11 collision-safe tools)
curl.exe -s "$base/mcp/tools" -H "Authorization: Bearer $token"
# 4. real MCP JSON-RPC against the gateway (Streamable HTTP; SSE or JSON reply)
$body = '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
curl.exe -s -X POST "$base/mcp" -H "Authorization: Bearer $token" -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' -d $body
# 5. tool call through to an upstream
$body = '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"inventory__lookup_item","arguments":{"sku":"TSHIRT-001"}}}'
curl.exe -s -X POST "$base/mcp" -H "Authorization: Bearer $token" -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' -d $body
# 6. audit trail for the call
curl.exe -s "$base/api/audit" -H "Authorization: Bearer $token"
```
A ready-to-run copy of this sequence (with body files and SSE parsing) lives in
`smoke/smoke-test.ps1` — run: `powershell -ExecutionPolicy Bypass -File smoke/smoke-test.ps1`.

Notes:
- `/mcp` and `/mcp/tools` accept a team API key (`Authorization: Bearer urumi_…`)
  or a dashboard JWT — both go through the same auth middleware.
- A tools/list response that lists all namespaced tools (`inventory__…`, `notes__…`,
  `woocommerce__…`) plus a tools/call returning the item JSON proves the full
  gateway → upstream aggregation path.

## Rollback / troubleshooting
```powershell
helm history platform -n urumi
helm rollback platform 1 -n urumi
kubectl -n urumi describe pod -l app.kubernetes.io/instance=platform   # stuck events
kubectl -n urumi logs deploy/gateway --tail=100 --since=10m            # errors
```
