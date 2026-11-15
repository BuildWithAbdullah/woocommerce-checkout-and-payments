// Every pair in this repository is a file that has the problem and a file that
// does not, and the manifest states the EXACT set of findings each one
// produces. Both sets are compared in both directions by test/pairs.test.mjs.
//
// Exact, not inclusion. An assertion that only checks the declared findings
// are present lets a file emit any number of findings it has not declared and
// still pass, which makes every false positive the corpus triggers invisible
// by construction. Switching this repository's predecessors to exact set
// equality is what found the only false positives anybody has found in them.
//
// `residual` is the set the corrected file still produces. An empty residual
// is a claim that the correction is complete, and it is checked like any
// other.

export const PAIRS = [
  {
    slug: 'checkout-fields',
    area: 'checkout-form',
    title: 'Labels, autofill tokens and required state on the billing and shipping fields',
    before: 'patterns/checkout-fields.before.html',
    after: 'patterns/checkout-fields.after.html',
    findings: [
      'address-fields-ungrouped@minor',
      'autocomplete-missing@moderate',
      'autocomplete-token-wrong@moderate',
      'field-without-label@serious',
      'label-not-associated@serious',
      'placeholder-as-label@serious',
      'required-not-programmatic@serious',
    ],
    residual: [],
  },
  {
    slug: 'validation-errors',
    area: 'checkout-form',
    title: 'Telling a shopper what failed, where they can hear it',
    before: 'patterns/validation-errors.before.html',
    after: 'patterns/validation-errors.after.html',
    findings: [
      'error-not-associated@serious',
      'error-summary-missing@moderate',
      'field-invalid-not-marked@serious',
    ],
    residual: [],
  },
  {
    slug: 'payment-method-list',
    area: 'payment-methods',
    title: 'A payment choice built out of clickable divs, and the same choice built out of radios',
    before: 'patterns/payment-method-list.before.html',
    after: 'patterns/payment-method-list.after.html',
    findings: [
      'field-without-label@serious',
      'payment-box-not-announced@serious',
      'payment-form-js-only@moderate',
      'payment-list-not-radiogroup@critical',
      'terms-checkbox-unlabelled@serious',
    ],
    residual: [],
  },
  {
    slug: 'hosted-card-fields',
    area: 'payment-methods',
    title: 'The gateway iframe and the saved card list',
    before: 'patterns/hosted-card-fields.before.html',
    after: 'patterns/hosted-card-fields.after.html',
    findings: [
      'field-without-label@serious',
      'gateway-iframe-not-reachable@critical',
      'gateway-iframe-untitled@serious',
      'saved-card-not-distinguishable@serious',
    ],
    residual: [],
  },
  {
    slug: 'checkout-head',
    area: 'script-footprint',
    title: 'What the checkout loads before it renders anything',
    before: 'patterns/checkout-head.before.html',
    after: 'patterns/checkout-head.after.html',
    findings: [
      'blocking-script-in-checkout-head@moderate',
      'blocks-stylesheet-unused@minor',
      'cart-count-has-no-server-value@moderate',
      'gateway-sdk-loaded-twice@serious',
      'gateway-sdk-loaded-when-unavailable@moderate',
    ],
    residual: [],
  },
  {
    slug: 'gateway-retry',
    area: 'gateway-failures',
    title: 'Charging once, and deciding what a timeout means',
    before: 'patterns/gateway-retry.before.php',
    after: 'patterns/gateway-retry.after.php',
    findings: [
      'charge-without-idempotency-key@critical',
      'gateway-call-without-timeout@serious',
      'timeout-treated-as-decline@critical',
    ],
    residual: [],
  },
  {
    slug: 'gateway-webhook',
    area: 'gateway-failures',
    title: 'A webhook that believes what arrives, and one that checks',
    before: 'patterns/gateway-webhook.before.php',
    after: 'patterns/gateway-webhook.after.php',
    findings: [
      'status-set-without-guard@critical',
      'webhook-not-idempotent@serious',
      'webhook-signature-unverified@critical',
    ],
    residual: [],
  },
  {
    slug: 'card-logging',
    area: 'gateway-failures',
    title: 'What goes in the log and what the shopper is told',
    before: 'patterns/card-logging.before.php',
    after: 'patterns/card-logging.after.php',
    findings: [
      'card-data-in-log@critical',
      'gateway-error-shown-raw@minor',
      'gateway-error-shown-raw@moderate',
    ],
    residual: [],
  },
  {
    slug: 'capture-flow',
    area: 'gateway-failures',
    title: 'Authorise, capture, redirect and refund',
    before: 'patterns/capture-flow.before.php',
    after: 'patterns/capture-flow.after.php',
    findings: [
      'completed-before-capture@critical',
      'payment-endpoint-without-nonce@critical',
      'redirect-flow-loses-order-reference@serious',
      'refund-not-recorded-locally@serious',
    ],
    residual: [],
  },
  {
    slug: 'tax-arithmetic',
    area: 'tax-and-shipping',
    title: 'Rounding, the amount sent to the gateway, and a VAT number',
    before: 'patterns/tax-arithmetic.before.php',
    after: 'patterns/tax-arithmetic.after.php',
    findings: [
      'display-and-charge-tax-mismatch@critical',
      'tax-rounded-twice@serious',
      'vat-number-accepted-unchecked@minor',
    ],
    residual: [],
  },
  {
    slug: 'store-settings',
    area: 'tax-and-shipping',
    title: 'The tax and shipping settings behind a mixed catalogue',
    before: 'patterns/store-settings.before.json',
    after: 'patterns/store-settings.after.json',
    findings: [
      'digital-goods-taxed-at-shop-base@serious',
      'free-shipping-evaluated-before-coupon@moderate',
      'shipping-class-cost-applied-once@moderate',
      'shipping-zone-no-fallback@serious',
      'tax-from-billing-while-shipping-elsewhere@serious',
      'zero-rate-treated-as-exempt@moderate',
    ],
    residual: [],
  },
  {
    slug: 'script-enqueue',
    area: 'script-footprint',
    title: 'Which pages pay for the commerce bundles, and what the cart cookie does to the cache',
    before: 'patterns/script-enqueue.before.php',
    after: 'patterns/script-enqueue.after.php',
    findings: [
      'cart-cookie-disables-page-cache@serious',
      'commerce-scripts-on-content-pages@moderate',
      'commerce-scripts-on-content-pages@serious',
      'fragments-enqueued-everywhere@serious',
    ],
    residual: [],
  },
  {
    slug: 'mini-cart-fragments',
    area: 'cart-fragments',
    title: 'Keeping the mini cart current without a request per page',
    before: 'patterns/mini-cart-fragments.before.js',
    after: 'patterns/mini-cart-fragments.after.js',
    findings: [
      'fragments-not-cached-in-session@moderate',
      'fragments-refresh-on-frequent-event@serious',
      'fragments-request-in-critical-path@moderate',
    ],
    residual: [],
  },
  {
    slug: 'order-received',
    area: 'order-flow',
    title: 'Work done on the order received page, and whose order it is',
    before: 'patterns/order-received.before.php',
    after: 'patterns/order-received.after.php',
    findings: [
      'guest-order-not-linked-on-signup@minor',
      'order-received-without-key-check@critical',
      'thankyou-side-effect-not-idempotent@critical',
    ],
    residual: [],
  },
  {
    slug: 'basket-money',
    area: 'coupons-and-prices',
    title: 'A coupon, a discount and an amount in minor units',
    before: 'patterns/basket-money.before.php',
    after: 'patterns/basket-money.after.php',
    findings: [
      'coupon-code-matched-case-sensitively@moderate',
      'discount-applied-after-tax@serious',
      'minor-units-assumed-two@critical',
      'money-held-as-float@serious',
      'total-rounded-toward-zero@minor',
      'usage-limit-checked-without-lock@serious',
    ],
    residual: [],
  },
];

export const BY_SLUG = new Map(PAIRS.map((p) => [p.slug, p]));
