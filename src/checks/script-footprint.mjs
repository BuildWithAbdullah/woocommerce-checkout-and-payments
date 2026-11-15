// What WooCommerce loads, and on which pages. A store that enqueues its
// checkout bundle site wide is paying for the checkout on the home page, and
// the home page is where the shopper decides whether to carry on.

import { matchLines, codeLines } from '../php.mjs';
import { attr, hasAttr, byTag, textOf } from '../html.mjs';
import { hasClassMatching, ancestorOfTag, formControls, controlType } from '../a11y.mjs';

export const area = 'script-footprint';
export const kinds = ['php', 'html'];

const CHECKOUT_HANDLES = /['"](wc-checkout|woocommerce-checkout|wc-country-select|wc-address-i18n)['"]/;
const CART_HANDLES = /['"](wc-cart|woocommerce-cart|wc-add-to-cart)['"]/;
const ENQUEUE = /wp_enqueue_(script|style)\s*\(/;
const COMMERCE_GUARD = /is_checkout\s*\(|is_cart\s*\(|is_woocommerce\s*\(|is_product\s*\(|is_shop\s*\(|is_account_page\s*\(|is_order_received_page\s*\(/;
const SDK_HOSTS = /js\.stripe\.com|js\.braintreegateway\.com|paypal\.com\/sdk|checkout\.adyen\.com|checkout\.razorpay\.com|js\.squareup(sandbox)?\.com/i;
const SDK_NAME = /stripe|braintree|paypal|adyen|razorpay|square/i;
const PAYMENT_LIST = /payment[_-]?methods?/;
const SELECT_ENHANCEMENT = /selectWoo|select2/i;
const BLOCKS_STYLE = /wc-blocks-style|woocommerce\/assets\/client\/blocks/i;
const CLASSIC_CHECKOUT = /woocommerce-checkout|checkout_coupon|woocommerce-billing-fields/;

function fromPhp(doc) {
  const src = doc.text;
  const lines = codeLines(src);
  const out = [];
  for (const hit of matchLines(src, ENQUEUE)) {
    const isCheckout = CHECKOUT_HANDLES.test(hit.text);
    const isCart = !isCheckout && CART_HANDLES.test(hit.text);
    if (!isCheckout && !isCart) continue;
    const before = lines.slice(Math.max(0, hit.no - 10), hit.no - 1).map((l) => l.text).join('\n');
    if (COMMERCE_GUARD.test(before) || COMMERCE_GUARD.test(hit.text)) continue;
    out.push({
      id: 'commerce-scripts-on-content-pages',
      severity: isCheckout ? 'serious' : 'moderate',
      line: hit.no,
      detail: (isCheckout ? 'the checkout' : 'the cart') + ' bundle is enqueued with no page condition',
    });
  }
  return out;
}

// A URL ending in a slash has no basename, and reporting an empty one left
// the finding detail reading " blocks rendering in the checkout head".
function shortName(url) {
  const src = String(url || '');
  const base = src.split(/[?#]/)[0].replace(/\/+$/, '').split('/').pop();
  return base || src || 'a script';
}

function sdkHost(url) {
  const m = SDK_HOSTS.exec(String(url));
  return m ? m[0].toLowerCase() : null;
}

function fromHtml(doc) {
  const source = doc.text;
  const els = doc.elements;
  const out = [];
  const add = (id, severity, line, detail) => out.push({ id, severity, line, detail });

  const scripts = byTag(els, 'script').filter((el) => attr(el, 'src'));
  const links = byTag(els, 'link').filter((el) => (attr(el, 'rel') || '').toLowerCase().includes('stylesheet'));
  const pageText = source;

  // ---- the blocks stylesheet on a classic checkout ----------------------
  const hasBlocksStyle = links.some((el) => BLOCKS_STYLE.test(attr(el, 'href') || ''))
    || scripts.some((el) => BLOCKS_STYLE.test(attr(el, 'src') || ''));
  const classicCheckout = CLASSIC_CHECKOUT.test(pageText);
  const hasBlockMarkup = els.some((el) => hasClassMatching(el, /^wp-block-woocommerce/) || hasClassMatching(el, /^wc-block-/));
  if (hasBlocksStyle && classicCheckout && !hasBlockMarkup) {
    const at = links.find((el) => BLOCKS_STYLE.test(attr(el, 'href') || ''));
    add('blocks-stylesheet-unused', 'minor', at ? at.line : 1,
      'the blocks stylesheet is loaded on a checkout with no block markup in it');
  }

  // ---- the enhanced select, with nothing to enhance ---------------------
  const selects = byTag(els, 'select');
  const enhancement = scripts.find((el) => SELECT_ENHANCEMENT.test(attr(el, 'src') || ''))
    || links.find((el) => SELECT_ENHANCEMENT.test(attr(el, 'href') || ''));
  if (enhancement && !selects.length) {
    add('select-enhancement-loaded-site-wide', 'moderate', enhancement.line,
      'the enhanced select assets are on a page with no select element');
  }

  // ---- blocking the checkout's own render ------------------------------
  if (classicCheckout) {
    for (const el of scripts) {
      if (!ancestorOfTag(els, el, 'head')) continue;
      if (hasAttr(el, 'defer') || hasAttr(el, 'async')) continue;
      if ((attr(el, 'type') || '').toLowerCase() === 'module') continue;
      add('blocking-script-in-checkout-head', 'moderate', el.line,
        shortName(attr(el, 'src')) + ' blocks rendering in the checkout head');
    }
  }

  // ---- a gateway library for a gateway that is not on offer -------------
  const methodNames = formControls(els)
    .filter((el) => controlType(el) === 'radio')
    .map((el) => ((attr(el, 'value') || '') + ' ' + (attr(el, 'id') || '') + ' ' + (attr(el, 'class') || '')).toLowerCase())
    .join(' ');
  const hasPaymentList = els.some((el) => hasClassMatching(el, PAYMENT_LIST)) || /payment_method/.test(pageText);

  const seen = new Map();
  for (const el of scripts) {
    const host = sdkHost(attr(el, 'src'));
    if (!host) continue;
    seen.set(host, (seen.get(host) || 0) + 1);
    const vendor = (SDK_NAME.exec(host) || [''])[0].toLowerCase();
    const offered = vendor && methodNames.includes(vendor);
    if (!offered && (!hasPaymentList || methodNames.length > 0)) {
      add('gateway-sdk-loaded-when-unavailable', 'moderate', el.line,
        host + ' is loaded and no available payment method uses it');
    }
  }
  for (const [host, count] of seen) {
    if (count > 1) {
      const at = scripts.find((el) => sdkHost(attr(el, 'src')) === host);
      add('gateway-sdk-loaded-twice', 'serious', at.line, count + ' copies of ' + host + ' on one page');
    }
  }

  return out;
}

export function check(doc) {
  return doc.kind === 'php' ? fromPhp(doc) : fromHtml(doc);
}
