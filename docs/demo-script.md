# Demo script (definition-of-done walkthrough)

## Store
1. Open `http://store.urumi.local` → add product → checkout with Cash on Delivery.
2. wp-admin → WooCommerce → Orders: order appears.

## Chat (User A)
1. Login as A → Chat → "create a product named Demo Tee at $19.99".
2. Storefront shows Demo Tee. Buy it (COD).
3. "Which orders came in today?" → agent calls `woocommerce__list_orders`, returns your order.
4. Audit Logs: calls attributed to A.

## External MCP (User B)
1. MCP Inspector with gateway URL + B's `urumi_…` key → tools from all 3 servers visible.
2. Ask orders question → works. Ask cross-server prompt (notes + inventory) → correct routing, logged under B.

## Failure drills
1. Revoke B's key → next call 401.
2. Disable notes-mcp → its tools vanish; direct call → TOOL_NOT_FOUND.
3. Delete inventory-mcp pod → dashboard shows Unreachable; Woo + notes still work.
4. Audit shows successes + failures with correct users.
