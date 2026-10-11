<?php
require_once "/var/www/html/wp-load.php";
global $wpdb;
$uid = 1;
$ck = "ck_" . bin2hex(random_bytes(20));
$cs = "cs_" . bin2hex(random_bytes(20));
$desc = "Urumi Gateway (generated)";
$perms = "read_write";
$table = $wpdb->prefix . "woocommerce_api_keys";
$wpdb->insert($table, [
  "user_id" => $uid,
  "description" => $desc,
  "permissions" => $perms,
  "consumer_key" => wc_api_hash($ck),
  "consumer_secret" => $cs,
  "truncated_key" => substr($ck, -7),
]);
echo "CONSUMER_KEY=" . $ck . "\n";
echo "CONSUMER_SECRET=" . $cs . "\n";
