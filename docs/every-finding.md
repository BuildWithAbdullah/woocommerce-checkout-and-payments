# Every finding

Generated from `src/catalogue.mjs` by `tools/catalogue-doc.mjs`. Do not edit it
by hand; CI fails when it does not match the catalogue.

One entry per reason a checkout can be wrong, not one per check. Two checks
that fail for the same reason share an entry, and one check that can fail for
three reasons gets three.

`Severities` is the complete set the finding can be emitted at, asserted in
both directions: a severity a real run produces that is not listed here fails
the build, and a severity listed here that no artefact in the repository has
ever produced fails the build too.

`Reached by` names the example or fixture that produces it, so every row is
something you can run rather than something you have to believe.

64 findings across 8 areas.

## The checkout form itself

`checkout-form`, 12 findings.

### `field-without-label`

A checkout field has no programmatic label, so a screen reader announces its type and nothing else.

- Severities: `serious`
- What to do: Give the field a label element whose for attribute names its id, or an aria-label.
- Reached by: `checkout-fields`, `hosted-card-fields`, `payment-method-list`

### `label-not-associated`

A label exists and reads correctly on screen, but its for attribute names no field on the page.

- Severities: `serious`
- What to do: Make the for attribute equal to the id of the field it labels. A typo here is invisible on screen.
- Reached by: `checkout-fields`

### `placeholder-as-label`

A placeholder is the only labelling a field has, so the name of the field disappears as soon as it is filled in.

- Severities: `serious`
- What to do: Add a real label. A placeholder is a hint, not a name.
- Reached by: `checkout-fields`

### `autocomplete-missing`

A field whose purpose is in the known autofill set carries no autocomplete token, so the browser cannot fill it.

- Severities: `serious`, `moderate`
- What to do: Add the autocomplete token for the field purpose. Serious on a payment field, where the alternative is typing a card number by hand.
- Reached by: `card-number-field.html`, `checkout-fields`

### `autocomplete-token-wrong`

An autocomplete token is present but is not the token for that field purpose, so autofill puts the wrong value in.

- Severities: `moderate`
- What to do: Use the token from the HTML autofill field list that matches the purpose, and keep the shipping and billing sections prefixed.
- Reached by: `checkout-fields`

### `required-not-programmatic`

A field marked required on screen with an asterisk is not required in the markup.

- Severities: `serious`
- What to do: Add required, or aria-required when the form validates on the server, as well as the visible marker.
- Reached by: `checkout-fields`

### `error-not-associated`

An error message sits next to its field in the layout but is not referenced from the field, so it is never read out with it.

- Severities: `serious`
- What to do: Point the field aria-describedby at the id of its message.
- Reached by: `validation-errors`

### `field-invalid-not-marked`

A field has an error message but is not marked invalid, so assistive technology reports it as fine.

- Severities: `serious`
- What to do: Set aria-invalid on the field for as long as the message is shown, and remove it when the value is corrected.
- Reached by: `validation-errors`

### `error-summary-not-focusable`

An error summary is rendered at the top of the form but cannot receive focus and is not announced, so a keyboard user never learns it is there.

- Severities: `serious`
- What to do: Give the summary tabindex of -1 and move focus to it, or give it role of alert, and prefer moving focus so the list can be read.
- Reached by: `error-summary-not-focusable.html`

### `error-summary-missing`

Validation errors are rendered inline only, so a shopper at the bottom of a long checkout has no way to find out what failed higher up.

- Severities: `moderate`
- What to do: Render a summary at the top of the form listing each failure as a link to its field.
- Reached by: `validation-errors`

### `fieldset-missing-legend`

A fieldset groups fields without a legend, so the grouping exists in the markup and is announced as nothing.

- Severities: `moderate`
- What to do: Add a legend, or drop the fieldset and use a heading.
- Reached by: `fieldset-missing-legend.html`

### `address-fields-ungrouped`

Billing and shipping fields run together in one flat list, so the two addresses are indistinguishable without reading the visible headings.

- Severities: `minor`
- What to do: Wrap each address in its own fieldset with a legend, or in a section with an accessible name.
- Reached by: `checkout-fields`

## Choosing and operating a payment method

`payment-methods`, 8 findings.

### `payment-list-not-radiogroup`

Payment methods are clickable list items rather than radio inputs, so the choice cannot be made or heard as a choice.

- Severities: `critical`
- What to do: Use radio inputs with a shared name inside a fieldset with a legend. This is the markup WooCommerce ships; a custom list usually replaces it.
- Reached by: `payment-method-list`

### `payment-radio-no-name`

Payment radios have no shared name attribute, so each one is its own group and more than one can be selected.

- Severities: `serious`
- What to do: Give every payment radio the same name attribute.
- Reached by: `payment-radio-no-name.html`

### `gateway-iframe-untitled`

A payment iframe has no title, so the card field is announced as an unnamed frame.

- Severities: `serious`
- What to do: Set a title on the iframe describing what it contains, for example the card number field.
- Reached by: `hosted-card-fields`

### `gateway-iframe-not-reachable`

A payment iframe is taken out of the tab order, so the card fields cannot be reached by keyboard at all.

- Severities: `critical`
- What to do: Remove the negative tabindex and the aria-hidden from the frame holding the card fields.
- Reached by: `hosted-card-fields`

### `payment-box-not-announced`

The panel that appears when a payment method is chosen is neither focus managed nor in a live region, so choosing a method appears to do nothing.

- Severities: `serious`
- What to do: Move focus to the panel, or mark it as a live region, and tie it to its method with aria-controls.
- Reached by: `payment-method-list`

### `saved-card-not-distinguishable`

Saved cards are told apart only by a brand image with no alternative text, so every saved card has the same accessible name.

- Severities: `serious`
- What to do: Put the brand and the last four digits in the label text of each saved card.
- Reached by: `hosted-card-fields`

### `terms-checkbox-unlabelled`

The terms checkbox is explained by adjacent text that is not associated with it, so the thing being agreed to is not announced.

- Severities: `serious`
- What to do: Wrap the text in the label element, or point aria-describedby at the paragraph holding the terms.
- Reached by: `payment-method-list`

### `payment-form-js-only`

The place order button does nothing without JavaScript and the form has no action, so a failed script leaves a checkout that cannot be submitted.

- Severities: `moderate`
- What to do: Keep the form action and let the submit work server side, then enhance it.
- Reached by: `payment-method-list`

## When the gateway does not behave

`gateway-failures`, 11 findings.

### `charge-without-idempotency-key`

A charge is sent with no idempotency key, so a retried request takes the money twice.

- Severities: `critical`
- What to do: Send a key derived from the order and the attempt, and reuse it for every retry of the same attempt.
- Reached by: `gateway-retry`

### `webhook-signature-unverified`

A gateway webhook is acted on without verifying its signature, so anyone who knows the URL can mark orders paid.

- Severities: `critical`
- What to do: Verify the signature against the raw request body before reading a single field.
- Reached by: `gateway-webhook`

### `webhook-not-idempotent`

A webhook handler applies the same event every time it arrives, and gateways redeliver by design.

- Severities: `serious`
- What to do: Record the event id and return early when it has been seen.
- Reached by: `gateway-webhook`

### `timeout-treated-as-decline`

A network timeout is handled as a decline, when a timeout means the outcome is unknown and the money may already be gone.

- Severities: `critical`
- What to do: Put the order in a pending state, record the attempt, and reconcile against the gateway before telling the shopper anything.
- Reached by: `gateway-retry`

### `card-data-in-log`

Card data reaches a log call, where it is kept for as long as the log is and read by anyone who can read the log.

- Severities: `critical`, `serious`
- What to do: Log an order id and a gateway reference, never the instrument. Critical for a full number or a security code, serious for an expiry date beside the last four.
- Reached by: `card-logging`, `expiry-date-in-log.php`

### `gateway-error-shown-raw`

The gateway error string is passed through to the shopper, which tells them nothing they can act on and sometimes tells them something they should not see.

- Severities: `moderate`, `minor`
- What to do: Map gateway codes to sentences a shopper can act on. Moderate when it is printed on the page, minor when it only lands in an order note.
- Reached by: `card-logging`

### `gateway-call-without-timeout`

An HTTP call to the gateway sets no timeout, so a slow gateway holds a PHP worker until the server gives up.

- Severities: `serious`
- What to do: Set an explicit timeout, and decide in advance what the code does when it fires.
- Reached by: `gateway-retry`

### `completed-before-capture`

The order is moved to a paid status before the capture result is known.

- Severities: `critical`
- What to do: Set the paid status from the capture response or the webhook, not from the authorisation.
- Reached by: `capture-flow`

### `redirect-flow-loses-order-reference`

A redirect or challenge flow sends the shopper away without storing the order reference, so the return cannot be matched to an order.

- Severities: `serious`
- What to do: Store the order id and key against the session or in the return URL before redirecting.
- Reached by: `capture-flow`

### `refund-not-recorded-locally`

A refund is issued at the gateway with no matching refund recorded against the order, so the two systems disagree from then on.

- Severities: `serious`
- What to do: Create the refund through the WooCommerce API so the order totals and the reports follow.
- Reached by: `capture-flow`

### `payment-endpoint-without-nonce`

An endpoint that moves money is reachable without a nonce or capability check.

- Severities: `critical`
- What to do: Verify a nonce and the current user capability before doing anything, and treat a missing nonce as a refusal.
- Reached by: `capture-flow`

## Tax, shipping and where the money lands

`tax-and-shipping`, 9 findings.

### `tax-rounded-twice`

Tax is rounded at the line and again at the total, so the total does not equal the sum of its lines.

- Severities: `serious`
- What to do: Round once, at the point the figure is presented or sent, and keep full precision until then.
- Reached by: `tax-arithmetic`

### `zero-rate-treated-as-exempt`

A zero rated item is handled as exempt, which is the same number on the invoice and a different line in the return.

- Severities: `moderate`
- What to do: Keep a zero percent rate rather than removing the tax class, so the sale still appears in the tax report.
- Reached by: `store-settings`

### `display-and-charge-tax-mismatch`

The price shown to the shopper includes tax and the amount sent to the gateway does not, so the charge does not match the page.

- Severities: `critical`
- What to do: Derive the gateway amount from the same total that was displayed, and assert the two are equal before charging.
- Reached by: `tax-arithmetic`

### `shipping-zone-no-fallback`

No shipping zone covers addresses outside the configured ones, so a shopper there reaches checkout and is offered nothing.

- Severities: `serious`
- What to do: Add a zone covering the rest of the world, even if its only method refuses politely.
- Reached by: `store-settings`

### `shipping-class-cost-applied-once`

A per class shipping cost is applied once per order rather than once per class, so a mixed basket is undercharged.

- Severities: `moderate`
- What to do: Choose per class costing deliberately and test a basket that spans two classes.
- Reached by: `store-settings`

### `free-shipping-evaluated-before-coupon`

The free shipping threshold is tested against the pre discount total, so a coupon that drops the basket below the threshold still gets free shipping.

- Severities: `moderate`
- What to do: Test the threshold against the total after discounts, and say which one you mean in the setting description.
- Reached by: `store-settings`

### `digital-goods-taxed-at-shop-base`

Downloadable goods are taxed at the shop base rather than the customer location, which is the one case where the shop base is usually wrong.

- Severities: `serious`
- What to do: Set the tax location for digital goods to the customer address and keep evidence of it.
- Reached by: `store-settings`

### `vat-number-accepted-unchecked`

A VAT number field accepts anything at all, so a typo becomes a zero rated sale you cannot defend.

- Severities: `minor`
- What to do: Check the shape at least, and verify against the registry before zero rating.
- Reached by: `tax-arithmetic`

### `tax-from-billing-while-shipping-elsewhere`

Tax is calculated from the billing address while the goods ship somewhere else.

- Severities: `serious`
- What to do: Calculate from the shipping address when there is one, and fall back to billing only when there is not.
- Reached by: `store-settings`

## Cart fragments and what they cost

`cart-fragments`, 6 findings.

### `fragments-enqueued-everywhere`

The cart fragments script is enqueued on pages that have no cart in them, so every page pays for an AJAX request it does not use.

- Severities: `serious`, `moderate`
- What to do: Enqueue it where a mini cart is rendered. Serious when it is site wide, moderate when it is only on the archives.
- Reached by: `fragments-on-archive-pages.php`, `script-enqueue`

### `fragments-not-cached-in-session`

The fragment response is not kept in session storage, so the same request is made again on every page.

- Severities: `moderate`
- What to do: Cache the response and the cart hash, and only refetch when the hash changes.
- Reached by: `mini-cart-fragments`

### `fragments-request-in-critical-path`

The fragment refresh is fired before the page has rendered, so it competes with the things the shopper is waiting for.

- Severities: `moderate`
- What to do: Fire it after load, or on the first interaction with the mini cart.
- Reached by: `mini-cart-fragments`

### `cart-cookie-disables-page-cache`

A no cache header is sent for every visitor who has a cart cookie, so the whole site becomes uncacheable for anyone who has added to a basket.

- Severities: `serious`
- What to do: Keep the page cacheable and let the fragments carry the per visitor part, which is the reason fragments exist.
- Reached by: `script-enqueue`

### `fragments-refresh-on-frequent-event`

A fragment refresh is bound to an event that fires continuously, so one shopper generates a stream of uncached requests.

- Severities: `serious`
- What to do: Bind to the cart changing, not to scrolling or resizing, and debounce whatever you bind to.
- Reached by: `mini-cart-fragments`

### `cart-count-has-no-server-value`

The basket count is rendered empty and filled in by the fragment request, so it is visibly wrong for as long as that request takes.

- Severities: `moderate`
- What to do: Render the count server side and let the fragment correct it.
- Reached by: `checkout-head`

## What WooCommerce loads and where

`script-footprint`, 6 findings.

### `commerce-scripts-on-content-pages`

Checkout and cart scripts are enqueued on pages that are not the checkout or the cart.

- Severities: `serious`, `moderate`
- What to do: Gate the enqueue on the page actually being a commerce page. Serious for the checkout bundle, moderate for the cart bundle.
- Reached by: `script-enqueue`

### `blocks-stylesheet-unused`

The WooCommerce blocks stylesheet is loaded on a checkout built from the classic shortcode, where nothing uses it.

- Severities: `minor`
- What to do: Dequeue it when the page has no blocks, and check the mini cart first because it is often the one thing that does.
- Reached by: `checkout-head`

### `select-enhancement-loaded-site-wide`

The enhanced select script and its stylesheet load on pages with no select element at all.

- Severities: `moderate`
- What to do: Enqueue them with the fields that need them.
- Reached by: `select-enhancement-site-wide.html`

### `blocking-script-in-checkout-head`

A script in the head of the checkout blocks rendering, on the one page where an abandoned load costs an order.

- Severities: `moderate`
- What to do: Move it to the footer, or defer it, and measure the checkout rather than the home page.
- Reached by: `checkout-head`

### `gateway-sdk-loaded-when-unavailable`

A gateway SDK is loaded even when that gateway is not among the available methods, so the shopper downloads a payment library they cannot use.

- Severities: `moderate`
- What to do: Enqueue the SDK from the gateway payment_scripts hook, which only runs when the gateway is available.
- Reached by: `checkout-head`

### `gateway-sdk-loaded-twice`

Two copies of the same gateway SDK are on the page, which is a double download and sometimes two competing instances.

- Severities: `serious`
- What to do: Register the SDK once under one handle and depend on that handle everywhere.
- Reached by: `checkout-head`

## Order status and the pages around it

`order-flow`, 6 findings.

### `thankyou-side-effect-not-idempotent`

A side effect runs on the order received page, which reloads, gets shared and gets prefetched.

- Severities: `critical`
- What to do: Do the work once on a payment complete hook, and guard it with a flag stored on the order.
- Reached by: `order-received`

### `stock-reduced-before-payment`

Stock is reduced when the order is created rather than when payment is taken, so abandoned checkouts eat the inventory.

- Severities: `serious`
- What to do: Reduce stock on payment complete, and hold it for the checkout window if you need to.
- Reached by: `stock-reduced-before-payment.php`

### `status-set-without-guard`

A status is set without looking at the current one, so a webhook that arrives late moves a refunded or cancelled order back to paid.

- Severities: `critical`
- What to do: Read the current status and refuse transitions that go backwards.
- Reached by: `gateway-webhook`

### `processing-email-for-unpaid-order`

The order confirmation is sent for an order that has not been paid, which tells the shopper their order is on its way when nothing has happened.

- Severities: `moderate`
- What to do: Send on payment complete. For an offline method, send a different email that says what to do next.
- Reached by: `processing-email-for-unpaid-order.php`

### `order-received-without-key-check`

The order received page loads an order by id without checking the order key, so changing a number in the URL shows somebody else their order.

- Severities: `critical`
- What to do: Compare the key in the request against the order key before rendering anything.
- Reached by: `order-received`

### `guest-order-not-linked-on-signup`

An account created during checkout is not linked to the order that created it, so the first thing the new account shows is no orders.

- Severities: `minor`
- What to do: Set the customer id on the order once the account exists.
- Reached by: `order-received`

## Coupons, discounts and money arithmetic

`coupons-and-prices`, 6 findings.

### `usage-limit-checked-without-lock`

A coupon usage limit is read and then incremented without a lock, so two simultaneous checkouts both pass the check.

- Severities: `serious`
- What to do: Make the increment conditional on the count you read, and treat a zero row count as the limit having been reached.
- Reached by: `basket-money`

### `discount-applied-after-tax`

A percentage discount is taken off a total that already includes tax, so the tax figure no longer matches the goods.

- Severities: `serious`
- What to do: Discount the net line amounts and recalculate tax, which is also the only version that survives an audit.
- Reached by: `basket-money`

### `money-held-as-float`

Money is added up in floating point, so the total drifts by a penny on baskets of a certain size and the drift is not reproducible.

- Severities: `serious`
- What to do: Work in minor units as integers, or in a decimal type, and convert once at the edge.
- Reached by: `basket-money`

### `minor-units-assumed-two`

The amount sent to the gateway is multiplied by one hundred unconditionally, which is wrong for every currency that does not have two decimal places.

- Severities: `critical`
- What to do: Take the exponent from the currency, and send the integer the gateway documents for it.
- Reached by: `basket-money`

### `coupon-code-matched-case-sensitively`

A coupon code is compared case sensitively, so the code printed in capitals on the flyer does not work.

- Severities: `moderate`
- What to do: Normalise the case on both sides before comparing, and keep the stored code as it was entered.
- Reached by: `basket-money`

### `total-rounded-toward-zero`

A total is rounded toward zero rather than to nearest, so the figure shown is systematically under the figure charged.

- Severities: `minor`
- What to do: Round half up, or round once at the end, and make the displayed total and the charged total the same expression.
- Reached by: `basket-money`
