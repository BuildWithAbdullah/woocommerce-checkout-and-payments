// What the checkers in this repository cannot see, each one with two files
// beside it: a blind example where the limit shows, and a contrast example
// where the same checker gets the same subject right. Both sets are asserted
// exactly, in both directions, by test/limits.test.mjs.
//
// The reason the limits are code rather than prose is that a paragraph
// saying a checker cannot see something still reads correctly after the
// checker learns to see it, and a reader then trusts a caveat that is no
// longer true. docs/what-the-checkers-cannot-see.md is generated from this
// file and CI fails if it is stale.
//
// Two kinds, and the difference matters to a reader:
//
//   hides        the blind example has the problem and nothing is reported.
//   manufactures the blind example does not have the problem and something
//                is reported anyway. A finding you have to know to discard.

export const LIMIT_KINDS = ['hides', 'manufactures'];

export const LIMITS = [
  {
    id: 'stylesheets-are-not-read',
    kind: 'hides',
    headline: 'No stylesheet is read, so anything a rule puts on the page is not there to be found.',
    prose:
      'A required marker drawn by a CSS rule on the label is invisible to this reader, and so is a field a stylesheet has hidden, reordered or shrunk to nothing. The blind example is required on screen and reported as fine.',
    blind: 'limits/css-required-marker.blind.html',
    blindFindings: [],
    contrast: 'limits/css-required-marker.contrast.html',
    contrastFindings: [
      'required-not-programmatic@serious',
    ],
  },
  {
    id: 'scripts-are-not-run',
    kind: 'manufactures',
    headline: 'Nothing here executes JavaScript, so a page is read exactly as the server sent it.',
    prose:
      'A name, a required flag or an error message attached at runtime is not seen, and the field is reported as though it never got one. This is the direction that costs a reader time, because the finding is wrong rather than missing.',
    blind: 'limits/js-attached-name.blind.html',
    blindFindings: [
      'field-without-label@serious',
    ],
    contrast: 'limits/js-attached-name.contrast.html',
    contrastFindings: [],
  },
  {
    id: 'template-markup-is-read-as-live',
    kind: 'manufactures',
    headline: 'Markup inside a template element is parsed like any other markup.',
    prose:
      'A field a script clones out of a template later is read as if it were on the page now, and reported on. The same is true of any markup a framework ships inert.',
    blind: 'limits/template-content.blind.html',
    blindFindings: [
      'field-without-label@serious',
    ],
    contrast: 'limits/template-content.contrast.html',
    contrastFindings: [],
  },
  {
    id: 'an-implied-head-is-not-a-head',
    kind: 'hides',
    headline: 'The element tree is the one written in the file, not the one a browser builds from it.',
    prose:
      'A browser creates a head element and hoists metadata and scripts into it. This reader does not, so a blocking script written before the body with no head element around it is not found in a head and is not reported.',
    blind: 'limits/implicit-head.blind.html',
    blindFindings: [],
    contrast: 'limits/implicit-head.contrast.html',
    contrastFindings: [
      'blocking-script-in-checkout-head@moderate',
    ],
  },
  {
    id: 'source-is-read-not-evaluated',
    kind: 'hides',
    headline: 'PHP and JavaScript are matched as text. Nothing is evaluated and no value is followed.',
    prose:
      'A gateway call made through a callable rather than a named method, and a script handle assembled from two strings, are both invisible. Every pattern in this repository is a pattern over source, and that is the cost of it.',
    blind: 'limits/read-not-evaluated.blind.php',
    blindFindings: [],
    contrast: 'limits/read-not-evaluated.contrast.php',
    contrastFindings: [
      'charge-without-idempotency-key@critical',
      'commerce-scripts-on-content-pages@serious',
    ],
  },
  {
    id: 'one-line-at-a-time',
    kind: 'hides',
    headline: 'Patterns are tested against single lines, with comments blanked first.',
    prose:
      'A call whose arguments are on the lines below it is matched on the call line only, so an argument that would have decided the finding is not part of what was read. Formatting therefore changes the result, which is the least satisfying property this reader has.',
    blind: 'limits/one-line-at-a-time.blind.php',
    blindFindings: [],
    contrast: 'limits/one-line-at-a-time.contrast.php',
    contrastFindings: [
      'commerce-scripts-on-content-pages@serious',
    ],
  },
  {
    id: 'evidence-is-file-scoped',
    kind: 'hides',
    headline: 'When a check looks for evidence that something was done properly, it looks across the whole file.',
    prose:
      'Two charges in one file, one of them carrying an idempotency key, means the keyed call vouches for the unkeyed one. The same shape applies to a signature check, a nonce check and a capture confirmation.',
    blind: 'limits/file-scoped-evidence.blind.php',
    blindFindings: [],
    contrast: 'limits/file-scoped-evidence.contrast.php',
    contrastFindings: [
      'charge-without-idempotency-key@critical',
    ],
  },
  {
    id: 'no-cross-file-reasoning',
    kind: 'manufactures',
    headline: 'Each file is read on its own. Nothing is followed into another file.',
    prose:
      'A hook registered conditionally in one file and implemented in another reads as unconditional, and the finding reported against the second file is wrong. Splitting a guard from the thing it guards is ordinary plugin structure, so expect this one.',
    blind: 'limits/cross-file-guard.blind.php',
    blindFindings: [
      'commerce-scripts-on-content-pages@serious',
    ],
    contrast: 'limits/cross-file-guard.contrast.php',
    contrastFindings: [],
  },
  {
    id: 'absent-config-keys-say-nothing',
    kind: 'hides',
    headline: 'A key the store description does not carry is not a finding.',
    prose:
      'The description is a file an operator fills in by hand, and demanding every key would make an incomplete file look like a broken store. The cost is that an empty section passes, so a clean result on a sparse description means very little.',
    blind: 'limits/absent-config-keys.blind.json',
    blindFindings: [],
    contrast: 'limits/absent-config-keys.contrast.json',
    contrastFindings: [
      'digital-goods-taxed-at-shop-base@serious',
    ],
  },
  {
    id: 'nothing-is-measured',
    kind: 'hides',
    headline: 'No request is made and no page is loaded, so every cost here is read off the source.',
    prose:
      'A fragment request placed correctly and cached correctly can still return a quarter of a megabyte on every cart change, and that is invisible. Where a call sits can be read; what it returns cannot.',
    blind: 'limits/runtime-cost.blind.js',
    blindFindings: [],
    contrast: 'limits/runtime-cost.contrast.js',
    contrastFindings: [
      'fragments-not-cached-in-session@moderate',
      'fragments-request-in-critical-path@moderate',
    ],
  },
];

export const BY_ID = new Map(LIMITS.map((l) => [l.id, l]));
