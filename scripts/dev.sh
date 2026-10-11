#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
npm install
npm run test --workspace=services/gateway
npm run build --workspace=services/gateway
echo "OK: gateway tests + build passed"
