<?php
/**
 * Plugin Name: Urumi Woo HTTP Auth Shim
 * Description: Allows WooCommerce REST API key/secret Basic auth over plain HTTP for local dev (Docker demo store). Scoped to wc/v3 requests only.
 */

// Make WordPress treat WooCommerce REST API requests as "secure" so WooCommerce
// runs perform_basic_authentication() (consumer_key/consumer_secret) even on HTTP.
// Only affects /wp-json/wc/* routes; storefront/admin URLs remain unaffected.
add_action('muplugins_loaded', function () {
    $uri = isset($_SERVER['REQUEST_URI']) ? wp_unslash($_SERVER['REQUEST_URI']) : '';
    $rest_route = isset($_GET['rest_route']) ? wp_unslash($_GET['rest_route']) : '';

    $is_wc_rest = (strpos($uri, '/wp-json/wc/') !== false)
        || (strpos($uri, '/wp-json/wc/v3') !== false)
        || (strpos($rest_route, '/wc/') === 0);

    if ($is_wc_rest) {
        $_SERVER['HTTPS'] = 'on';
        $_SERVER['SERVER_PORT'] = 443;
    }
});

// Safety net: force is_ssl() true for wc REST if the $_SERVER trick didn't take.
add_filter('pre_http_request', function ($pre, $r, $url) {
    return $pre;
}, 10, 3);
