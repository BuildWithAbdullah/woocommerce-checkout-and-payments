// Fixtures reach the findings no pattern pair reaches, and the severities no
// pair produces. Each one declares the EXACT set it emits, compared both
// ways by test/fixtures.test.mjs, so a fixture that starts producing
// something new fails the build rather than passing quietly.
//
// A fixture exists because the catalogue rule in this repository is one entry
// per reason. Writing a pair for every reason would mean writing a corrected
// example for a mistake whose correction is the same correction as its
// neighbour; writing a fixture instead keeps the catalogue honest without
// padding the pairs.

export const FIXTURES = [
  {
    file: 'fixtures/error-summary-not-focusable.html',
    area: 'checkout-form',
    title: 'A summary nobody is sent to',
    findings: [
      'error-summary-not-focusable@serious',
    ],
  },
  {
    file: 'fixtures/fieldset-missing-legend.html',
    area: 'checkout-form',
    title: 'A group with no name',
    findings: [
      'fieldset-missing-legend@moderate',
    ],
  },
  {
    file: 'fixtures/payment-radio-no-name.html',
    area: 'payment-methods',
    title: 'Three methods in three groups',
    findings: [
      'payment-radio-no-name@serious',
    ],
  },
  {
    file: 'fixtures/card-number-field.html',
    area: 'checkout-form',
    title: 'A card number field with no autofill token',
    findings: [
      'autocomplete-missing@serious',
    ],
  },
  {
    file: 'fixtures/select-enhancement-site-wide.html',
    area: 'script-footprint',
    title: 'The enhanced select on an article page',
    findings: [
      'select-enhancement-loaded-site-wide@moderate',
    ],
  },
  {
    file: 'fixtures/stock-reduced-before-payment.php',
    area: 'order-flow',
    title: 'Inventory down before the money is in',
    findings: [
      'stock-reduced-before-payment@serious',
    ],
  },
  {
    file: 'fixtures/processing-email-for-unpaid-order.php',
    area: 'order-flow',
    title: 'An order confirmed before it is paid',
    findings: [
      'processing-email-for-unpaid-order@moderate',
    ],
  },
  {
    file: 'fixtures/expiry-date-in-log.php',
    area: 'gateway-failures',
    title: 'An expiry date beside the last four, in a log',
    findings: [
      'card-data-in-log@serious',
    ],
  },
  {
    file: 'fixtures/fragments-on-archive-pages.php',
    area: 'cart-fragments',
    title: 'Fragments on the archives rather than where a basket is shown',
    findings: [
      'fragments-enqueued-everywhere@moderate',
    ],
  },
];
