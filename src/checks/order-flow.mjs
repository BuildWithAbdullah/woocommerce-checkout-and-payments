// Order status and the pages around it. The order received page is the one
// page in a store that gets reloaded, shared, prefetched and bookmarked, and
// it is the page most often asked to do work.

import { matchLines, codeLines, codeText } from '../php.mjs';

export const area = 'order-flow';
export const kinds = ['php'];

const THANKYOU_HOOK = /add_action\s*\(\s*['"]woocommerce_thankyou/;
const NEW_ORDER_HOOK = /add_action\s*\(\s*['"](woocommerce_checkout_order_processed|woocommerce_new_order)/;
const SIDE_EFFECT = /wp_mail\s*\(|wp_remote_(post|get|request)\s*\(|->save\s*\(\s*\)|update_status\s*\(|wc_reduce_stock_levels\s*\(|->reduce_order_stock\s*\(|->add_order_note\s*\(|do_action\s*\(/;
const ONCE_GUARD = /get_meta\s*\(|get_post_meta\s*\(|has_meta\s*\(|get_transient\s*\(|wc_get_order_item_meta\s*\(/;
const STOCK_REDUCE = /wc_reduce_stock_levels\s*\(|->reduce_order_stock\s*\(/;
const STATUS_SET = /->(update_status|set_status)\s*\(/;
const STATUS_READ = /->(get_status|has_status)\s*\(/;
const HOOKED = /add_action\s*\(|add_filter\s*\(/;
const PROCESSING_SET = /->(update_status|set_status)\s*\(\s*['"]processing['"]/;
const PAID_CHECK = /->(is_paid|needs_payment)\s*\(|->get_date_paid\s*\(|payment_complete/;
const REQUEST_ORDER_ID = /\$_GET\s*\[\s*['"]order(_id)?['"]\s*\]|absint\s*\(\s*\$_GET|\$_REQUEST\s*\[\s*['"]order(_id)?['"]/;
const LOAD_ORDER = /wc_get_order\s*\(|new WC_Order\s*\(/;
const KEY_CHECKED = /get_order_key\s*\(|order_key/;
const CREATE_CUSTOMER = /wc_create_new_customer\s*\(|wp_insert_user\s*\(/;
const LINK_CUSTOMER = /set_customer_id\s*\(|['"]_customer_user['"]/;

export function check(doc) {
  const src = doc.text;
  const all = codeText(src);
  const lines = codeLines(src);
  const out = [];
  const add = (id, severity, line, detail) => out.push({ id, severity, line, detail });

  // ---- work done on the order received page -----------------------------
  for (const hit of matchLines(src, THANKYOU_HOOK)) {
    const after = lines.slice(hit.no - 1, hit.no + 40).map((l) => l.text).join('\n');
    if (SIDE_EFFECT.test(after) && !ONCE_GUARD.test(after)) {
      add('thankyou-side-effect-not-idempotent', 'critical', hit.no,
        'the order received page does work with nothing recording that it has been done');
    }
  }

  // ---- stock before money -----------------------------------------------
  for (const hit of matchLines(src, NEW_ORDER_HOOK)) {
    const after = lines.slice(hit.no - 1, hit.no + 40).map((l) => l.text).join('\n');
    if (STOCK_REDUCE.test(after)) {
      add('stock-reduced-before-payment', 'serious', hit.no,
        'stock comes down when the order is created, before anyone has paid');
    }
    if (PROCESSING_SET.test(after) && !PAID_CHECK.test(after)) {
      add('processing-email-for-unpaid-order', 'moderate', hit.no,
        'the order is moved to processing, and its email sent, without checking it is paid');
    }
  }

  // ---- transitions ------------------------------------------------------
  if (HOOKED.test(all) && !STATUS_READ.test(all)) {
    const sets = matchLines(src, STATUS_SET);
    if (sets.length) {
      add('status-set-without-guard', 'critical', sets[0].no,
        'a status is set without reading the one the order already has');
    }
  }

  // ---- whose order is this ----------------------------------------------
  if (REQUEST_ORDER_ID.test(all) && LOAD_ORDER.test(all) && !KEY_CHECKED.test(all)) {
    const at = matchLines(src, REQUEST_ORDER_ID);
    add('order-received-without-key-check', 'critical', at.length ? at[0].no : 1,
      'an order is loaded from a number in the URL with no key to go with it');
  }

  // ---- the account that was just created --------------------------------
  if (CREATE_CUSTOMER.test(all) && !LINK_CUSTOMER.test(all)) {
    const at = matchLines(src, CREATE_CUSTOMER);
    add('guest-order-not-linked-on-signup', 'minor', at.length ? at[0].no : 1,
      'the new account is never attached to the order that created it');
  }

  return out;
}
