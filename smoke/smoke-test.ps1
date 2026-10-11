# Urumi MCP Platform — live smoke test
# 1. login -> JWT  2. GET /mcp/tools  3. POST /mcp (tools/list)  4. POST /mcp/call
$ErrorActionPreference = 'Continue'
$base = 'http://localhost:8080'
$dir = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host '=== 1. healthz ==='
$h = curl.exe -s "$base/healthz"
Write-Host $h

Write-Host '=== 2. readyz ==='
$r = curl.exe -s "$base/readyz"
Write-Host $r

Write-Host '=== 3. login (JSON body file) ==='
$loginRaw = curl.exe -s -X POST "$base/api/auth/login" -H 'Content-Type: application/json' -d "@$dir\login.json"
Write-Host $loginRaw
$login = $loginRaw | ConvertFrom-Json
if (-not $login.ok) { Write-Host 'LOGIN FAILED - aborting'; exit 1 }
$token = $login.data.token
Write-Host "token acquired (len=$($token.Length))"

Write-Host '=== 4. GET /api/auth/me ==='
$me = curl.exe -s "$base/api/auth/me" -H "Authorization: Bearer $token"
Write-Host $me

Write-Host '=== 5. GET /mcp/tools ==='
$tools = curl.exe -s "$base/mcp/tools" -H "Authorization: Bearer $token"
Write-Host ($tools.Substring(0, [Math]::Min(1200, $tools.Length)))
$toolObj = $tools | ConvertFrom-Json
if ($toolObj.ok) {
    $names = $toolObj.data | ForEach-Object { $_.exposed }
    Write-Host "tool count: $($names.Count)"
    $names | ForEach-Object { Write-Host "  - $_" }
}

Write-Host '=== 6. POST /mcp/call inventory__lookup_item ==='
$call = curl.exe -s -X POST "$base/mcp/call" -H "Authorization: Bearer $token" -H 'Content-Type: application/json' -d "@$dir\call.json"
Write-Host $call

function Show-Resp($r, $label) {
  $s = (@($r) | Out-String).Trim()
  if (-not $s) { $s = '(empty response)' }
  Write-Host ($s.Substring(0, [Math]::Min(1500, $s.Length)))
}

Write-Host '=== 7. POST /mcp tools/list (JSON-RPC) ==='
$acc = 'Accept: application/json, text/event-stream'
$lst = curl.exe -s -X POST "$base/mcp" -H "Authorization: Bearer $token" -H 'Content-Type: application/json' -H $acc -d "@$dir\toolslist.json"
Show-Resp $lst

Write-Host '=== 8. POST /mcp tools/call inventory__lookup_item (JSON-RPC) ==='
$tc = curl.exe -s -X POST "$base/mcp" -H "Authorization: Bearer $token" -H 'Content-Type: application/json' -H $acc -d "@$dir\toolscall.json"
Show-Resp $tc

Write-Host '=== 9. recent gateway logs ==='
docker logs urumi-mcp-platform-gateway-1 --since 2m 2>&1 | Select-Object -Last 10

Write-Host '=== SMOKE TEST DONE ==='
