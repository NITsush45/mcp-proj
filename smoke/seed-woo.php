<?php
require_once "/var/www/html/wp-load.php";

if (!class_exists('WC_Product_Simple') || !function_exists('wc_create_order')) {
    fwrite(STDERR, "WooCommerce not available\n");
    exit(1);
}

// 1) Create two simple products if they don't already exist.
$products = [];
$defs = [
    ['name' => 'Urumi Demo Tee', 'regular_price' => '19.99'],
    ['name' => 'Urumi Demo Mug', 'regular_price' => '12.50'],
];
foreach ($defs as $d) {
    $existing = get_posts([
        'post_type' => 'product',
        'post_status' => 'publish',
        'numberposts' => 1,
        'title' => $d['name'],
    ]);
    if (!empty($existing)) {
        $products[] = wc_get_product($existing[0]->ID);
        continue;
    }
    $p = new WC_Product_Simple();
    $p->set_name($d['name']);
    $p->set_status('publish');
    $p->set_catalog_visibility('visible');
    $p->set_regular_price($d['regular_price']);
    $p->set_price($d['regular_price']);
    $p->save();
    $products[] = $p;
}

// 2) Create one order today, if we have at least one product.
$pid = $products[0]->get_id();
$address = [
    'first_name' => 'Demo', 'last_name' => 'Buyer',
    'company' => '', 'email' => 'demo@example.com', 'phone' => '555-0100',
    'address_1' => '123 Demo St', 'city' => 'Demo City', 'state' => 'CA',
    'postcode' => '90001', 'country' => 'US',
];

$recent = wc_get_orders([
    'limit' => 5, 'status' => ['processing', 'completed', 'on-hold'],
    'date_created' => '>' . (time() - 86400),
]);
if (count($recent) === 0) {
    for ($i = 0; $i < 2; $i++) {
        $order = wc_create_order();
        $order->add_product(wc_get_product($pid), 1);
        $order->set_address($address, 'billing');
        $order->set_address($address, 'shipping');
        $order->set_payment_method_title('Cash on Delivery');
        $order->set_status('processing');
        $order->calculate_totals();
        $order->save();
    }
    echo "SEEDED_ORDERS=2\n";
} else {
    echo "ORDERS_EXIST=" . count($recent) . "\n";
}

echo "PRODUCTS=" . implode(',', array_map(fn($p) => $p->get_id() . ':' . $p->get_name(), $products)) . "\n";
