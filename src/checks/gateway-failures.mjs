// What happens when the gateway declines, times out, redelivers a webhook, or
// answers something the code did not plan for. These are read out of PHP by
// line, with comments blanked first, which means a call assembled from a
// variable function name is invisible. That is declared in src/limits.mjs.

import { codeLines, matchLines, hasLine, codeText } from '../php.mjs';

export const area = 'gateway-failures';
export const kinds = ['php'];

const CHARGE_CALL = /->(charge|createCharge|create_charge|capture_payment)\s*\(|\b(Charge|PaymentIntent|Payment)::create\s*\(|->create_payment\s*\(/;
const WEBHOOK_FILE = /add_action\s*\(\s*['"]woocommerce_api_|add_action\s*\(\s*['"]wc_ajax_[a-z_]*webhook|function\s+\w*webhook\w*\s*\(|register_rest_route\s*\([^)]*webhook/i;
const PAYLOAD_READ = /file_get_contents\s*\(\s*['"]php:\/\/input|json_decode\s*\(|\$_POST\b|\$request->get_json_params\s*\(/;
const SIGNATURE_CHECK = /hash_hmac\s*\(|hash_equals\s*\(|verify_signature|constructEvent|verify_webhook|->verify\s*\(/i;
const EVENT_GUARD = /event_?id|already_?(handled|processed)|_processed|idempot/i;
const LOG_CALL = /error_log\s*\(|->(log|debug|info|notice|warning|error|critical)\s*\(/;
const CARD_CRITICAL = /card_?number|\bpan\b|\bcvc\b|\bcvv\b|security_?code|card_?code/i;
const CARD_SERIOUS = /exp_?(month|year)|expiry|exp_date|last_?4|last_?four/i;
const GATEWAY_ERROR = /\$(?:e|ex|exception)->getMessage\s*\(\)|->error(?:->|\s*\[\s*['"])message|\[\s*['"]error_message['"]\s*\]|\$\w+\s*\[\s*['"]error['"]\s*\]\s*\[\s*['"]message['"]\s*\]/;
const SHOWN_TO_SHOPPER = /wc_add_notice\s*\(|wc_print_notice\s*\(|\becho\b|wp_send_json_error\s*\(|throw new \w*Exception\s*\(/;
const ORDER_NOTE = /add_order_note\s*\(/;
const REMOTE_CALL = /\bwp_remote_(post|get|request|head)\s*\(/;
const PAID_STATUS = /->payment_complete\s*\(|->(update_status|set_status)\s*\(\s*['"](completed|processing)['"]/;
const AUTH_ONLY = /['"]capture(_method)?['"]\s*(=>|:)\s*(false|['"]manual['"])|->authori[sz]e\s*\(|['"]manual_capture['"]\s*=>\s*true/;
const CAPTURE_CONFIRMED = /->capture\s*\(|['"]capture['"]\s*=>\s*true|capture_payment\s*\(|->capture_charge\s*\(/;
const REDIRECT_AWAY = /wp_redirect\s*\(|wp_safe_redirect\s*\(|['"]redirect['"]\s*=>\s*\$/;
const REFERENCE_STORED = /update_meta_data\s*\(|add_post_meta\s*\(|update_post_meta\s*\(|->session->set\s*\(|set_transient\s*\(/;
const GATEWAY_REFUND = /->(refund|createRefund|create_refund)\s*\(|\bRefund::create\s*\(/;
const LOCAL_REFUND = /wc_create_refund\s*\(/;
const MONEY_ENDPOINT = /add_action\s*\(\s*['"]wp_ajax_[a-z_]*(pay|charge|refund|capture)|add_action\s*\(\s*['"]wc_ajax_[a-z_]*(pay|charge|refund|capture)|register_rest_route\s*\([^)]*(pay|charge|refund)/i;
const AUTHORISED = /check_ajax_referer\s*\(|wp_verify_nonce\s*\(|current_user_can\s*\(|permission_callback/;
const TIMEOUT_SEEN = /timed?[_ ]?out|cURL error 28|is_timeout|ETIMEDOUT/i;
const MARKED_FAILED = /->(update_status|set_status)\s*\(\s*['"]failed['"]/;

function statementText(lines, startIndex, maxLines) {
  let text = '';
  for (let k = startIndex; k < Math.min(lines.length, startIndex + maxLines); k++) {
    text += lines[k].text + '\n';
    if (/\)\s*;/.test(lines[k].text) && k > startIndex) break;
    if (k === startIndex && /\)\s*;/.test(lines[k].text)) break;
  }
  return text;
}

export function check(doc) {
  const src = doc.text;
  const lines = codeLines(src);
  const all = codeText(src);
  const out = [];
  const add = (id, severity, line, detail) => out.push({ id, severity, line, detail });

  const isWebhook = WEBHOOK_FILE.test(all);

  // ---- charging ----------------------------------------------------------
  const idempotent = /idempoten/i.test(all);
  for (const hit of matchLines(src, CHARGE_CALL)) {
    if (!idempotent) {
      add('charge-without-idempotency-key', 'critical', hit.no,
        'a charge is sent and nothing in this file carries an idempotency key');
    }
  }

  // ---- webhooks ----------------------------------------------------------
  if (isWebhook) {
    const payload = matchLines(src, PAYLOAD_READ);
    if (payload.length && !SIGNATURE_CHECK.test(all)) {
      add('webhook-signature-unverified', 'critical', payload[0].no,
        'the payload is read before anything verifies where it came from');
    }
    if (!EVENT_GUARD.test(all)) {
      const at = matchLines(src, WEBHOOK_FILE);
      add('webhook-not-idempotent', 'serious', at.length ? at[0].no : 1,
        'nothing records which events have already been applied');
    }
  }

  // ---- a timeout is not a decline ---------------------------------------
  // Reported once per file. The word timeout appears several times in any
  // honest handling of one, and reporting each occurrence turned a single
  // wrong code path into four findings about the same mistake.
  let timeoutReported = false;
  for (const hit of matchLines(src, TIMEOUT_SEEN)) {
    if (timeoutReported) break;
    const idx = hit.no - 1;
    for (let k = idx; k < Math.min(lines.length, idx + 7); k++) {
      if (MARKED_FAILED.test(lines[k].text)) {
        add('timeout-treated-as-decline', 'critical', hit.no,
          'a timeout at line ' + hit.no + ' reaches a failed status at line ' + lines[k].no);
        timeoutReported = true;
        break;
      }
    }
  }

  // ---- logging -----------------------------------------------------------
  for (const hit of matchLines(src, LOG_CALL)) {
    const text = statementText(lines, hit.no - 1, 4);
    if (CARD_CRITICAL.test(text)) {
      add('card-data-in-log', 'critical', hit.no, 'a log call reaches a card number or security code');
    } else if (CARD_SERIOUS.test(text)) {
      add('card-data-in-log', 'serious', hit.no, 'a log call reaches an expiry date or the last four digits');
    }
  }

  // ---- the gateway's words, verbatim ------------------------------------
  for (const line of lines) {
    if (!GATEWAY_ERROR.test(line.text)) continue;
    if (SHOWN_TO_SHOPPER.test(line.text)) {
      add('gateway-error-shown-raw', 'moderate', line.no, 'the gateway error string is printed for the shopper');
    } else if (ORDER_NOTE.test(line.text)) {
      add('gateway-error-shown-raw', 'minor', line.no, 'the gateway error string is copied into an order note');
    }
  }

  // ---- the call itself ---------------------------------------------------
  for (const hit of matchLines(src, REMOTE_CALL)) {
    const text = statementText(lines, hit.no - 1, 10);
    if (!/['"]timeout['"]\s*=>/.test(text)) {
      add('gateway-call-without-timeout', 'serious', hit.no, 'an HTTP call to the gateway sets no timeout');
    }
  }

  // ---- authorised is not captured ---------------------------------------
  if (AUTH_ONLY.test(all) && !CAPTURE_CONFIRMED.test(all)) {
    for (const hit of matchLines(src, PAID_STATUS)) {
      add('completed-before-capture', 'critical', hit.no,
        'the order is marked paid while the authorisation has not been captured');
    }
  }

  // ---- going away and coming back ---------------------------------------
  for (const hit of matchLines(src, REDIRECT_AWAY)) {
    const before = lines.slice(0, hit.no - 1).map((l) => l.text).join('\n');
    const inUrl = /order_?id|order-received|[?&]key=|order_key/.test(hit.text);
    if (!REFERENCE_STORED.test(before) && !inUrl) {
      add('redirect-flow-loses-order-reference', 'serious', hit.no,
        'the shopper is sent to the gateway with no stored reference to come back to');
    }
  }

  // ---- refunds -----------------------------------------------------------
  for (const hit of matchLines(src, GATEWAY_REFUND)) {
    if (!LOCAL_REFUND.test(all)) {
      add('refund-not-recorded-locally', 'serious', hit.no,
        'the gateway is refunded and WooCommerce is not told');
    }
  }

  // ---- who may ask -------------------------------------------------------
  for (const hit of matchLines(src, MONEY_ENDPOINT)) {
    if (!AUTHORISED.test(all)) {
      add('payment-endpoint-without-nonce', 'critical', hit.no,
        'an endpoint that moves money checks neither a nonce nor a capability');
    }
  }

  return out;
}
