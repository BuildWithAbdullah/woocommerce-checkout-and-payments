// Cart fragments. The mechanism exists so that a page can be cached while the
// basket in its header is not, and almost every way of getting it wrong turns
// that around: the fragment request runs on pages with no basket in them, or
// the page stops being cacheable the moment a basket exists.

import { matchLines, codeLines, codeText } from '../php.mjs';
import { attr, byTag, textOf } from '../html.mjs';
import { hasClassMatching } from '../a11y.mjs';

export const area = 'cart-fragments';
export const kinds = ['php', 'js', 'html', 'conf'];

const FRAGMENTS_ENQUEUE = /wp_enqueue_script\s*\(\s*['"]wc-cart-fragments['"]|wp_enqueue_script\s*\(\s*['"]woocommerce-cart-fragments['"]/;
const CART_PAGE_GUARD = /is_cart\s*\(|is_checkout\s*\(|has_?mini_?cart|is_woocommerce\s*\(|mini-cart/i;
const BROAD_GUARD = /is_archive\s*\(|is_shop\s*\(|is_product_category\s*\(|is_product\s*\(|is_front_page\s*\(/;
const FRAGMENT_TOKEN = /wc_fragments|cart_fragments|wc_fragment_refresh|refresh_?fragments/i;
const CLIENT_STORE = /sessionStorage|localStorage/;
const READY_BLOCK = /DOMContentLoaded|document\s*\)\s*\.ready|\$\s*\(\s*function|jQuery\s*\(\s*function/;
const FREQUENT_EVENT = /addEventListener\s*\(\s*['"](scroll|resize|mousemove|touchmove|wheel)['"]|\.\s*on\s*\(\s*['"](scroll|resize|mousemove|touchmove)/;
const NOCACHE = /nocache_headers\s*\(|Cache-Control[^,;]*no-(cache|store)|header\s*\(\s*['"]Cache-Control/i;
const CART_COOKIE = /woocommerce_items_in_cart|woocommerce_cart_hash|wp_woocommerce_session|wc_cart_created/i;
const COUNT_CLASS = /cart-count|cart-contents-count|mini-cart-count|cart-items-count/;

function fromPhp(doc) {
  const src = doc.text;
  const lines = codeLines(src);
  const out = [];
  for (const hit of matchLines(src, FRAGMENTS_ENQUEUE)) {
    const before = lines.slice(Math.max(0, hit.no - 9), hit.no - 1).map((l) => l.text).join('\n');
    if (CART_PAGE_GUARD.test(before)) continue;
    const severity = BROAD_GUARD.test(before) ? 'moderate' : 'serious';
    out.push({
      id: 'fragments-enqueued-everywhere',
      severity,
      line: hit.no,
      detail: severity === 'serious'
        ? 'the fragments script is enqueued with no page condition at all'
        : 'the fragments script is enqueued across the archives, which have no basket in them',
    });
  }

  for (const hit of matchLines(src, NOCACHE)) {
    const before = lines.slice(Math.max(0, hit.no - 7), hit.no - 1).map((l) => l.text).join('\n');
    if (CART_COOKIE.test(before) || CART_COOKIE.test(hit.text)) {
      out.push({
        id: 'cart-cookie-disables-page-cache',
        severity: 'serious',
        line: hit.no,
        detail: 'every visitor with a basket cookie is served an uncacheable page',
      });
    }
  }
  return out;
}

function fromConf(doc) {
  const out = [];
  const lines = doc.text.split(/\r?\n/);
  lines.forEach((text, idx) => {
    if (!NOCACHE.test(text)) return;
    const window = lines.slice(Math.max(0, idx - 6), idx + 1).join('\n');
    if (CART_COOKIE.test(window)) {
      out.push({
        id: 'cart-cookie-disables-page-cache',
        severity: 'serious',
        line: idx + 1,
        detail: 'the server rule turns caching off for anyone holding a basket cookie',
      });
    }
  });
  return out;
}

function fromJs(doc) {
  const src = doc.text;
  const lines = codeLines(src);
  const all = codeText(src);
  const out = [];
  if (!FRAGMENT_TOKEN.test(all)) return out;

  if (!CLIENT_STORE.test(all)) {
    const at = matchLines(src, FRAGMENT_TOKEN);
    out.push({
      id: 'fragments-not-cached-in-session',
      severity: 'moderate',
      line: at.length ? at[0].no : 1,
      detail: 'the fragment response is never kept, so the request repeats on every page',
    });
  }

  for (const hit of matchLines(src, FRAGMENT_TOKEN)) {
    const before = lines.slice(Math.max(0, hit.no - 11), hit.no - 1).map((l) => l.text).join('\n');
    if (READY_BLOCK.test(before) && /refresh|trigger|ajax|fetch/i.test(hit.text)) {
      out.push({
        id: 'fragments-request-in-critical-path',
        severity: 'moderate',
        line: hit.no,
        detail: 'the refresh is fired while the page is still rendering',
      });
      break;
    }
  }

  for (const hit of matchLines(src, FREQUENT_EVENT)) {
    const after = lines.slice(hit.no - 1, hit.no + 8).map((l) => l.text).join('\n');
    if (FRAGMENT_TOKEN.test(after) && /refresh|trigger|ajax|fetch/i.test(after)) {
      out.push({
        id: 'fragments-refresh-on-frequent-event',
        severity: 'serious',
        line: hit.no,
        detail: 'a fragment refresh is bound to an event that fires continuously',
      });
    }
  }

  return out;
}

function fromHtml(doc) {
  const out = [];
  for (const el of doc.elements) {
    if (!hasClassMatching(el, COUNT_CLASS)) continue;
    if (byTag([el], 'input').length) continue;
    const text = textOf(doc.text, el);
    const dataCount = attr(el, 'data-count');
    if (!text && !dataCount) {
      out.push({
        id: 'cart-count-has-no-server-value',
        severity: 'moderate',
        line: el.line,
        detail: 'the basket count is rendered empty and waits for the fragment request',
      });
    }
  }
  return out;
}

export function check(doc) {
  if (doc.kind === 'php') return fromPhp(doc);
  if (doc.kind === 'js') return fromJs(doc);
  if (doc.kind === 'conf') return fromConf(doc);
  return fromHtml(doc);
}
