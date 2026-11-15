// The catalogue is one entry per reason a checkout can be wrong, not one entry
// per check that happens to exist. Two checks that fail for the same reason
// share an entry; one check that can fail for three different reasons gets
// three. That is what keeps the catalogue honest as a list of things a reader
// might actually have wrong, and it is the rule that has found more real
// defects in this repository than any other.
//
// `severities` is the complete set of severities the finding can be emitted
// at. It is asserted in both directions: a severity a real run produces that
// is not declared here fails the build, and a severity declared here that no
// test has ever produced fails the build too. The second direction is the one
// that does the work, because it refuses to let this file make a promise the
// corpus does not keep.

export const SEVERITIES = ['minor', 'moderate', 'serious', 'critical'];

export const SEVERITY_RANK = { minor: 1, moderate: 2, serious: 3, critical: 4 };

export const AREAS = [
  { id: 'checkout-form', title: 'The checkout form itself' },
  { id: 'payment-methods', title: 'Choosing and operating a payment method' },
  { id: 'gateway-failures', title: 'When the gateway does not behave' },
  { id: 'tax-and-shipping', title: 'Tax, shipping and where the money lands' },
  { id: 'cart-fragments', title: 'Cart fragments and what they cost' },
  { id: 'script-footprint', title: 'What WooCommerce loads and where' },
  { id: 'order-flow', title: 'Order status and the pages around it' },
  { id: 'coupons-and-prices', title: 'Coupons, discounts and money arithmetic' },
];

const C = (id, area, title, severities, remedy) => ({ id, area, title, severities, remedy });

export const CATALOGUE = [
  // ---------------------------------------------------------------- form ----
  C('field-without-label', 'checkout-form',
    'A checkout field has no programmatic label, so a screen reader announces its type and nothing else',
    ['serious'],
    'Give the field a label element whose for attribute names its id, or an aria-label.'),
  C('label-not-associated', 'checkout-form',
    'A label exists and reads correctly on screen, but its for attribute names no field on the page',
    ['serious'],
    'Make the for attribute equal to the id of the field it labels. A typo here is invisible on screen.'),
  C('placeholder-as-label', 'checkout-form',
    'A placeholder is the only labelling a field has, so the name of the field disappears as soon as it is filled in',
    ['serious'],
    'Add a real label. A placeholder is a hint, not a name.'),
  C('autocomplete-missing', 'checkout-form',
    'A field whose purpose is in the known autofill set carries no autocomplete token, so the browser cannot fill it',
    ['serious', 'moderate'],
    'Add the autocomplete token for the field purpose. Serious on a payment field, where the alternative is typing a card number by hand.'),
  C('autocomplete-token-wrong', 'checkout-form',
    'An autocomplete token is present but is not the token for that field purpose, so autofill puts the wrong value in',
    ['moderate'],
    'Use the token from the HTML autofill field list that matches the purpose, and keep the shipping and billing sections prefixed.'),
  C('required-not-programmatic', 'checkout-form',
    'A field marked required on screen with an asterisk is not required in the markup',
    ['serious'],
    'Add required, or aria-required when the form validates on the server, as well as the visible marker.'),
  C('error-not-associated', 'checkout-form',
    'An error message sits next to its field in the layout but is not referenced from the field, so it is never read out with it',
    ['serious'],
    'Point the field aria-describedby at the id of its message.'),
  C('field-invalid-not-marked', 'checkout-form',
    'A field has an error message but is not marked invalid, so assistive technology reports it as fine',
    ['serious'],
    'Set aria-invalid on the field for as long as the message is shown, and remove it when the value is corrected.'),
  C('error-summary-not-focusable', 'checkout-form',
    'An error summary is rendered at the top of the form but cannot receive focus and is not announced, so a keyboard user never learns it is there',
    ['serious'],
    'Give the summary tabindex of -1 and move focus to it, or give it role of alert, and prefer moving focus so the list can be read.'),
  C('error-summary-missing', 'checkout-form',
    'Validation errors are rendered inline only, so a shopper at the bottom of a long checkout has no way to find out what failed higher up',
    ['moderate'],
    'Render a summary at the top of the form listing each failure as a link to its field.'),
  C('fieldset-missing-legend', 'checkout-form',
    'A fieldset groups fields without a legend, so the grouping exists in the markup and is announced as nothing',
    ['moderate'],
    'Add a legend, or drop the fieldset and use a heading.'),
  C('address-fields-ungrouped', 'checkout-form',
    'Billing and shipping fields run together in one flat list, so the two addresses are indistinguishable without reading the visible headings',
    ['minor'],
    'Wrap each address in its own fieldset with a legend, or in a section with an accessible name.'),

  // ------------------------------------------------------------- payment ----
  C('payment-list-not-radiogroup', 'payment-methods',
    'Payment methods are clickable list items rather than radio inputs, so the choice cannot be made or heard as a choice',
    ['critical'],
    'Use radio inputs with a shared name inside a fieldset with a legend. This is the markup WooCommerce ships; a custom list usually replaces it.'),
  C('payment-radio-no-name', 'payment-methods',
    'Payment radios have no shared name attribute, so each one is its own group and more than one can be selected',
    ['serious'],
    'Give every payment radio the same name attribute.'),
  C('gateway-iframe-untitled', 'payment-methods',
    'A payment iframe has no title, so the card field is announced as an unnamed frame',
    ['serious'],
    'Set a title on the iframe describing what it contains, for example the card number field.'),
  C('gateway-iframe-not-reachable', 'payment-methods',
    'A payment iframe is taken out of the tab order, so the card fields cannot be reached by keyboard at all',
    ['critical'],
    'Remove the negative tabindex and the aria-hidden from the frame holding the card fields.'),
  C('payment-box-not-announced', 'payment-methods',
    'The panel that appears when a payment method is chosen is neither focus managed nor in a live region, so choosing a method appears to do nothing',
    ['serious'],
    'Move focus to the panel, or mark it as a live region, and tie it to its method with aria-controls.'),
  C('saved-card-not-distinguishable', 'payment-methods',
    'Saved cards are told apart only by a brand image with no alternative text, so every saved card has the same accessible name',
    ['serious'],
    'Put the brand and the last four digits in the label text of each saved card.'),
  C('terms-checkbox-unlabelled', 'payment-methods',
    'The terms checkbox is explained by adjacent text that is not associated with it, so the thing being agreed to is not announced',
    ['serious'],
    'Wrap the text in the label element, or point aria-describedby at the paragraph holding the terms.'),
  C('payment-form-js-only', 'payment-methods',
    'The place order button does nothing without JavaScript and the form has no action, so a failed script leaves a checkout that cannot be submitted',
    ['moderate'],
    'Keep the form action and let the submit work server side, then enhance it.'),

  // ------------------------------------------------------------- gateway ----
  C('charge-without-idempotency-key', 'gateway-failures',
    'A charge is sent with no idempotency key, so a retried request takes the money twice',
    ['critical'],
    'Send a key derived from the order and the attempt, and reuse it for every retry of the same attempt.'),
  C('webhook-signature-unverified', 'gateway-failures',
    'A gateway webhook is acted on without verifying its signature, so anyone who knows the URL can mark orders paid',
    ['critical'],
    'Verify the signature against the raw request body before reading a single field.'),
  C('webhook-not-idempotent', 'gateway-failures',
    'A webhook handler applies the same event every time it arrives, and gateways redeliver by design',
    ['serious'],
    'Record the event id and return early when it has been seen.'),
  C('timeout-treated-as-decline', 'gateway-failures',
    'A network timeout is handled as a decline, when a timeout means the outcome is unknown and the money may already be gone',
    ['critical'],
    'Put the order in a pending state, record the attempt, and reconcile against the gateway before telling the shopper anything.'),
  C('card-data-in-log', 'gateway-failures',
    'Card data reaches a log call, where it is kept for as long as the log is and read by anyone who can read the log',
    ['critical', 'serious'],
    'Log an order id and a gateway reference, never the instrument. Critical for a full number or a security code, serious for an expiry date beside the last four.'),
  C('gateway-error-shown-raw', 'gateway-failures',
    'The gateway error string is passed through to the shopper, which tells them nothing they can act on and sometimes tells them something they should not see',
    ['moderate', 'minor'],
    'Map gateway codes to sentences a shopper can act on. Moderate when it is printed on the page, minor when it only lands in an order note.'),
  C('gateway-call-without-timeout', 'gateway-failures',
    'An HTTP call to the gateway sets no timeout, so a slow gateway holds a PHP worker until the server gives up',
    ['serious'],
    'Set an explicit timeout, and decide in advance what the code does when it fires.'),
  C('completed-before-capture', 'gateway-failures',
    'The order is moved to a paid status before the capture result is known',
    ['critical'],
    'Set the paid status from the capture response or the webhook, not from the authorisation.'),
  C('redirect-flow-loses-order-reference', 'gateway-failures',
    'A redirect or challenge flow sends the shopper away without storing the order reference, so the return cannot be matched to an order',
    ['serious'],
    'Store the order id and key against the session or in the return URL before redirecting.'),
  C('refund-not-recorded-locally', 'gateway-failures',
    'A refund is issued at the gateway with no matching refund recorded against the order, so the two systems disagree from then on',
    ['serious'],
    'Create the refund through the WooCommerce API so the order totals and the reports follow.'),
  C('payment-endpoint-without-nonce', 'gateway-failures',
    'An endpoint that moves money is reachable without a nonce or capability check',
    ['critical'],
    'Verify a nonce and the current user capability before doing anything, and treat a missing nonce as a refusal.'),

  // ------------------------------------------------------- tax, shipping ----
  C('tax-rounded-twice', 'tax-and-shipping',
    'Tax is rounded at the line and again at the total, so the total does not equal the sum of its lines',
    ['serious'],
    'Round once, at the point the figure is presented or sent, and keep full precision until then.'),
  C('zero-rate-treated-as-exempt', 'tax-and-shipping',
    'A zero rated item is handled as exempt, which is the same number on the invoice and a different line in the return',
    ['moderate'],
    'Keep a zero percent rate rather than removing the tax class, so the sale still appears in the tax report.'),
  C('display-and-charge-tax-mismatch', 'tax-and-shipping',
    'The price shown to the shopper includes tax and the amount sent to the gateway does not, so the charge does not match the page',
    ['critical'],
    'Derive the gateway amount from the same total that was displayed, and assert the two are equal before charging.'),
  C('shipping-zone-no-fallback', 'tax-and-shipping',
    'No shipping zone covers addresses outside the configured ones, so a shopper there reaches checkout and is offered nothing',
    ['serious'],
    'Add a zone covering the rest of the world, even if its only method refuses politely.'),
  C('shipping-class-cost-applied-once', 'tax-and-shipping',
    'A per class shipping cost is applied once per order rather than once per class, so a mixed basket is undercharged',
    ['moderate'],
    'Choose per class costing deliberately and test a basket that spans two classes.'),
  C('free-shipping-evaluated-before-coupon', 'tax-and-shipping',
    'The free shipping threshold is tested against the pre discount total, so a coupon that drops the basket below the threshold still gets free shipping',
    ['moderate'],
    'Test the threshold against the total after discounts, and say which one you mean in the setting description.'),
  C('digital-goods-taxed-at-shop-base', 'tax-and-shipping',
    'Downloadable goods are taxed at the shop base rather than the customer location, which is the one case where the shop base is usually wrong',
    ['serious'],
    'Set the tax location for digital goods to the customer address and keep evidence of it.'),
  C('vat-number-accepted-unchecked', 'tax-and-shipping',
    'A VAT number field accepts anything at all, so a typo becomes a zero rated sale you cannot defend',
    ['minor'],
    'Check the shape at least, and verify against the registry before zero rating.'),
  C('tax-from-billing-while-shipping-elsewhere', 'tax-and-shipping',
    'Tax is calculated from the billing address while the goods ship somewhere else',
    ['serious'],
    'Calculate from the shipping address when there is one, and fall back to billing only when there is not.'),

  // ----------------------------------------------------------- fragments ----
  C('fragments-enqueued-everywhere', 'cart-fragments',
    'The cart fragments script is enqueued on pages that have no cart in them, so every page pays for an AJAX request it does not use',
    ['serious', 'moderate'],
    'Enqueue it where a mini cart is rendered. Serious when it is site wide, moderate when it is only on the archives.'),
  C('fragments-not-cached-in-session', 'cart-fragments',
    'The fragment response is not kept in session storage, so the same request is made again on every page',
    ['moderate'],
    'Cache the response and the cart hash, and only refetch when the hash changes.'),
  C('fragments-request-in-critical-path', 'cart-fragments',
    'The fragment refresh is fired before the page has rendered, so it competes with the things the shopper is waiting for',
    ['moderate'],
    'Fire it after load, or on the first interaction with the mini cart.'),
  C('cart-cookie-disables-page-cache', 'cart-fragments',
    'A no cache header is sent for every visitor who has a cart cookie, so the whole site becomes uncacheable for anyone who has added to a basket',
    ['serious'],
    'Keep the page cacheable and let the fragments carry the per visitor part, which is the reason fragments exist.'),
  C('fragments-refresh-on-frequent-event', 'cart-fragments',
    'A fragment refresh is bound to an event that fires continuously, so one shopper generates a stream of uncached requests',
    ['serious'],
    'Bind to the cart changing, not to scrolling or resizing, and debounce whatever you bind to.'),
  C('cart-count-has-no-server-value', 'cart-fragments',
    'The basket count is rendered empty and filled in by the fragment request, so it is visibly wrong for as long as that request takes',
    ['moderate'],
    'Render the count server side and let the fragment correct it.'),

  // ------------------------------------------------------------ footprint ----
  C('commerce-scripts-on-content-pages', 'script-footprint',
    'Checkout and cart scripts are enqueued on pages that are not the checkout or the cart',
    ['serious', 'moderate'],
    'Gate the enqueue on the page actually being a commerce page. Serious for the checkout bundle, moderate for the cart bundle.'),
  C('blocks-stylesheet-unused', 'script-footprint',
    'The WooCommerce blocks stylesheet is loaded on a checkout built from the classic shortcode, where nothing uses it',
    ['minor'],
    'Dequeue it when the page has no blocks, and check the mini cart first because it is often the one thing that does.'),
  C('select-enhancement-loaded-site-wide', 'script-footprint',
    'The enhanced select script and its stylesheet load on pages with no select element at all',
    ['moderate'],
    'Enqueue them with the fields that need them.'),
  C('blocking-script-in-checkout-head', 'script-footprint',
    'A script in the head of the checkout blocks rendering, on the one page where an abandoned load costs an order',
    ['moderate'],
    'Move it to the footer, or defer it, and measure the checkout rather than the home page.'),
  C('gateway-sdk-loaded-when-unavailable', 'script-footprint',
    'A gateway SDK is loaded even when that gateway is not among the available methods, so the shopper downloads a payment library they cannot use',
    ['moderate'],
    'Enqueue the SDK from the gateway payment_scripts hook, which only runs when the gateway is available.'),
  C('gateway-sdk-loaded-twice', 'script-footprint',
    'Two copies of the same gateway SDK are on the page, which is a double download and sometimes two competing instances',
    ['serious'],
    'Register the SDK once under one handle and depend on that handle everywhere.'),

  // ----------------------------------------------------------- order flow ----
  C('thankyou-side-effect-not-idempotent', 'order-flow',
    'A side effect runs on the order received page, which reloads, gets shared and gets prefetched',
    ['critical'],
    'Do the work once on a payment complete hook, and guard it with a flag stored on the order.'),
  C('stock-reduced-before-payment', 'order-flow',
    'Stock is reduced when the order is created rather than when payment is taken, so abandoned checkouts eat the inventory',
    ['serious'],
    'Reduce stock on payment complete, and hold it for the checkout window if you need to.'),
  C('status-set-without-guard', 'order-flow',
    'A status is set without looking at the current one, so a webhook that arrives late moves a refunded or cancelled order back to paid',
    ['critical'],
    'Read the current status and refuse transitions that go backwards.'),
  C('processing-email-for-unpaid-order', 'order-flow',
    'The order confirmation is sent for an order that has not been paid, which tells the shopper their order is on its way when nothing has happened',
    ['moderate'],
    'Send on payment complete. For an offline method, send a different email that says what to do next.'),
  C('order-received-without-key-check', 'order-flow',
    'The order received page loads an order by id without checking the order key, so changing a number in the URL shows somebody else their order',
    ['critical'],
    'Compare the key in the request against the order key before rendering anything.'),
  C('guest-order-not-linked-on-signup', 'order-flow',
    'An account created during checkout is not linked to the order that created it, so the first thing the new account shows is no orders',
    ['minor'],
    'Set the customer id on the order once the account exists.'),

  // -------------------------------------------------- coupons and prices ----
  C('usage-limit-checked-without-lock', 'coupons-and-prices',
    'A coupon usage limit is read and then incremented without a lock, so two simultaneous checkouts both pass the check',
    ['serious'],
    'Make the increment conditional on the count you read, and treat a zero row count as the limit having been reached.'),
  C('discount-applied-after-tax', 'coupons-and-prices',
    'A percentage discount is taken off a total that already includes tax, so the tax figure no longer matches the goods',
    ['serious'],
    'Discount the net line amounts and recalculate tax, which is also the only version that survives an audit.'),
  C('money-held-as-float', 'coupons-and-prices',
    'Money is added up in floating point, so the total drifts by a penny on baskets of a certain size and the drift is not reproducible',
    ['serious'],
    'Work in minor units as integers, or in a decimal type, and convert once at the edge.'),
  C('minor-units-assumed-two', 'coupons-and-prices',
    'The amount sent to the gateway is multiplied by one hundred unconditionally, which is wrong for every currency that does not have two decimal places',
    ['critical'],
    'Take the exponent from the currency, and send the integer the gateway documents for it.'),
  C('coupon-code-matched-case-sensitively', 'coupons-and-prices',
    'A coupon code is compared case sensitively, so the code printed in capitals on the flyer does not work',
    ['moderate'],
    'Normalise the case on both sides before comparing, and keep the stored code as it was entered.'),
  C('total-rounded-toward-zero', 'coupons-and-prices',
    'A total is rounded toward zero rather than to nearest, so the figure shown is systematically under the figure charged',
    ['minor'],
    'Round half up, or round once at the end, and make the displayed total and the charged total the same expression.'),
];

export const BY_ID = new Map(CATALOGUE.map((entry) => [entry.id, entry]));

export function entry(id) {
  const found = BY_ID.get(id);
  if (!found) throw new Error('unknown finding id: ' + id);
  return found;
}

export function declaredSeverities(id) {
  return entry(id).severities.slice();
}

export function byArea(areaId) {
  return CATALOGUE.filter((e) => e.area === areaId);
}

// Exit code policy, used by src/cli.mjs and derived independently by
// tools/exit-codes.mjs from the manifests, so the two cannot drift.
export function exitCodeFor(severitiesSeen) {
  if (!severitiesSeen.length) return 0;
  const worst = Math.max(...severitiesSeen.map((s) => SEVERITY_RANK[s] || 0));
  if (worst >= 4) return 3;
  if (worst === 3) return 2;
  return 1;
}

export const USAGE_EXIT = 64;
