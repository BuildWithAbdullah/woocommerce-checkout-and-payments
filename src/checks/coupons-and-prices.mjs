// Coupons, discounts and the arithmetic underneath them. Every finding here is
// a number being wrong rather than a page being wrong, which is why they are
// the ones that survive longest in a live store: nobody reports a penny.

import { matchLines, codeLines, codeText } from '../php.mjs';

export const area = 'coupons-and-prices';
export const kinds = ['php'];

const USAGE_READ = /get_usage_count\s*\(|->usage_count|usage_count\s*=/;
const USAGE_WRITE = /increase_usage_count\s*\(|set_usage_count\s*\(|usage_count\s*\+\s*1|\+\+\s*\$?\w*usage|usage_count\s*\+=/;
const GUARDED = /GET_LOCK|FOR UPDATE|wp_cache_add\s*\(|\$wpdb->query\s*\(\s*\$wpdb->prepare\s*\(\s*["'][^"']*UPDATE[^"']*WHERE[^"']*usage/i;
const DISCOUNT_ON_GROSS = /(get_total\s*\(\s*\)|\$\w*(total_incl_tax|gross_total|total_with_tax))\s*\*\s*/;
const FLOAT_MONEY = /floatval\s*\(|\(\s*float\s*\)\s*\$\w*(price|total|amount|cost|subtotal)/i;
const TIMES_HUNDRED = /['"]amount['"]\s*=>[^,;]*\*\s*100\b|\$\w*(amount|total|price|subtotal)\w*\s*\*\s*100\b/i;
// Multiplying by a hundred and dividing by it again on the same line is
// scaling for a rounding step, not converting to minor units. An earlier
// version of this check reported `floor( $total * 100 ) / 100` as a gateway
// amount, which is a false positive on code whose only fault is the floor.
const ROUND_TRIP = /\*\s*100\b[^;]*\/\s*(100\b|pow\s*\()/;
const EXPONENT_AWARE = /currency_exponent|minor_unit|pow\s*\(\s*10|decimals_for|wc_get_price_decimals\s*\(/i;
const COUPON_FILE = /coupon/i;
const COUPON_COMPARE = /\$\w*(code|coupon)\w*\s*===?\s*(\$|['"])|in_array\s*\(\s*\$\w*(code|coupon)\b/i;
const CASE_NORMALISED = /strtolower\s*\(|strtoupper\s*\(|mb_strtolower\s*\(|wc_format_coupon_code\s*\(/;
const TRUNCATING = /\bfloor\s*\(\s*\$\w*(total|amount|price|subtotal)|\(\s*int\s*\)\s*\(?\s*\$\w*(total|amount|price|subtotal)|\bintval\s*\(\s*\$\w*(total|amount|price)/i;

export function check(doc) {
  const src = doc.text;
  const all = codeText(src);
  const lines = codeLines(src);
  const out = [];
  const add = (id, severity, line, detail) => out.push({ id, severity, line, detail });

  const reads = matchLines(src, USAGE_READ);
  if (reads.length && !GUARDED.test(all)) {
    for (const read of reads) {
      const after = lines.slice(read.no - 1, read.no + 15).map((l) => l.text).join('\n');
      if (USAGE_WRITE.test(after)) {
        add('usage-limit-checked-without-lock', 'serious', read.no,
          'the usage count is read here and incremented below with nothing between them');
        break;
      }
    }
  }

  if (/tax/i.test(all)) {
    for (const hit of matchLines(src, DISCOUNT_ON_GROSS)) {
      if (!/discount|percent|coupon/i.test(hit.text)) continue;
      add('discount-applied-after-tax', 'serious', hit.no,
        'the discount is taken off a total that already has tax in it');
    }
  }

  for (const hit of matchLines(src, FLOAT_MONEY)) {
    add('money-held-as-float', 'serious', hit.no, 'money is converted to a float and added up as one');
  }

  if (!EXPONENT_AWARE.test(all)) {
    for (const hit of matchLines(src, TIMES_HUNDRED)) {
      if (ROUND_TRIP.test(hit.text)) continue;
      add('minor-units-assumed-two', 'critical', hit.no,
        'the gateway amount is multiplied by one hundred whatever the currency is');
    }
  }

  if (COUPON_FILE.test(all) && !CASE_NORMALISED.test(all)) {
    for (const hit of matchLines(src, COUPON_COMPARE)) {
      add('coupon-code-matched-case-sensitively', 'moderate', hit.no,
        'the coupon code is compared exactly as it was typed');
    }
  }

  for (const hit of matchLines(src, TRUNCATING)) {
    add('total-rounded-toward-zero', 'minor', hit.no,
      'the total is truncated rather than rounded, so the figure shown is under the figure charged');
  }

  return out;
}
