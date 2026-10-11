// scripts/dev.ps1 — Windows helper: install + test + build gateway
$ErrorActionPreference = 'Stop'
Set-Location (Join-Path $PSScriptRoot '..')
npm install
npm run test --workspace=services/gateway
npm run build --workspace=services/gateway
Write-Host 'OK: gateway tests + build passed' -ForegroundColor Green
