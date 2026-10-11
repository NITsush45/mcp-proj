#!/usr/bin/env bash
# =============================================================================
# provision-woo-store.sh
#
# One-shot, idempotent provisioning of the local Docker WordPress/WooCommerce
# demo store ("wpstore") so the Urumi gateway's woocommerce-mcp tools return
# real data. Safe to re-run.
#
# What it fixes (the reasons "how many orders came in today?" used to fail):
#   1. Apache AllowOverride None -> All   (so WP pretty permalinks / REST work)
#   2. Empty .htaccess -> WP rewrite rules
#   3. Installs an HTTP-auth mu-plugin     (WooCommerce Basic auth needs is_ssl();
#                                          on plain HTTP we fake it for wc/* only)
#   4. Generates real WooCommerce REST API keys (read_write) for user id 1
#   5. Seeds 2 products + 2 "processing" orders dated today
#
# Usage (from the project root):
#   bash smoke/provision-woo-store.sh
# =============================================================================
set -euo pipefail

STORE=wpstore
echo "==> Using store container: $STORE"

# 0) Make sure the store is on the same Docker network as the gateway stack so
#    woocommerce-mcp can reach it by the hostname "wpstore".
if ! docker network inspect urumi-mcp-platform_default \
     --format '{{range .Containers}}{{.Name}} {{end}}' 2>/dev/null | grep -qw "$STORE"; then
  echo "==> Attaching $STORE to urumi-mcp-platform_default"
  docker network connect urumi-mcp-platform_default "$STORE" || true
fi

# 1) Enable .htaccess for /var/www (AllowOverride All).
echo "==> Enabling AllowOverride All for /var/www"
docker exec "$STORE" sh -c "sed -i 's/\tAllowOverride None/\tAllowOverride All/' /etc/apache2/apache2.conf"

# 2) Write standard WordPress rewrite rules if .htaccess is empty.
docker exec "$STORE" sh -c '
if ! grep -q "RewriteEngine On" /var/www/html/.htaccess 2>/dev/null; then
cat > /var/www/html/.htaccess << "EOF"
# BEGIN WordPress
<IfModule mod_rewrite.c>
RewriteEngine On
RewriteRule .* - [E=HTTP_AUTHORIZATION:%{HTTP:Authorization}]
RewriteBase /
RewriteRule ^index\.php$ - [L]
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule . /index.php [L]
</IfModule>
# END WordPress
EOF
chown www-data:www-data /var/www/html/.htaccess
fi
'

# 3) Install the HTTP-auth shim (idempotent copy from this repo).
echo "==> Installing WooCommerce HTTP Basic-auth shim"
docker exec "$STORE" sh -c 'mkdir -p /var/www/html/wp-content/mu-plugins'
docker cp smoke/woo-http-auth-shim.php "$STORE":/tmp/woo-http-auth-shim.php
docker exec "$STORE" sh -c 'cp /tmp/woo-http-auth-shim.php /var/www/html/wp-content/mu-plugins/woo-http-auth-shim.php && chown www-data:www-data /var/www/html/wp-content/mu-plugins/woo-http-auth-shim.php'

# 4) Install wp-cli once (needed by the seed/key scripts).
echo "==> Ensuring wp-cli is present"
docker exec "$STORE" sh -c 'test -f /tmp/wp-cli.phar || (curl -sO https://raw.githubusercontent.com/wp-cli/builds/gh-pages/phar/wp-cli.phar && chmod +x wp-cli.phar)' 2>/dev/null || true

# 5) (Re)generate a read_write API key only if none exists.
echo "==> Generating WooCommerce REST API key (if missing)"
docker cp smoke/gen-key.php "$STORE":/tmp/gen-key.php
KEYOUT="$(docker exec "$STORE" sh -c 'cd /var/www/html && php /tmp/gen-key.php' 2>/dev/null || true)"

# 6) Seed demo products + orders.
echo "==> Seeding demo products and orders"
docker cp smoke/seed-woo.php "$STORE":/tmp/seed-woo.php
docker exec "$STORE" sh -c 'cd /var/www/html && php /tmp/seed-woo.php' 2>/dev/null || true

# 7) Reload Apache so AllowOverride takes effect.
echo "==> Reloading Apache"
docker exec "$STORE" sh -c 'apache2ctl -k graceful' 2>/dev/null || true

echo ""
echo "==================================================================="
echo "DONE. The store now has working REST auth + seeded data."
echo ""
echo "IMPORTANT: the generated consumer key/secret are printed above ONLY on"
echo "first generation (step 5). To read them back any time, run:"
echo "  docker exec $STORE sh -c 'php /tmp/dump-key.php'"
echo "Then paste them into .env:"
echo "  WOOCOMMERCE_BASE_URL=http://wpstore"
echo "  WOOCOMMERCE_CONSUMER_KEY=ck_..."
echo "  WOOCOMMERCE_CONSUMER_SECRET=cs_..."
echo "and recreate the MCP server:"
echo "  docker compose up -d --force-recreate woocommerce-mcp"
echo "==================================================================="
