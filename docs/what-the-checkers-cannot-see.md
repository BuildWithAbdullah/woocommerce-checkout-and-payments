# What the checkers cannot see

Generated from `src/limits.mjs` by `tools/limits-doc.mjs`. Do not edit it by
hand; CI fails when it does not match the limits.

10 declared limits: 7 that hide a problem and 3 that manufacture a finding where there is none.

Each one has two files beside it under `limits/`. The blind file is where the
limit shows. The contrast file is the same subject handled in a way the same
checker gets right, which is what makes the entry a statement about the limit
rather than about the checker being broken. Both files have the exact set of
findings they produce declared in `src/limits.mjs`, compared in both
directions by `test/limits.test.mjs`.

## No stylesheet is read, so anything a rule puts on the page is not there to be found.

`stylesheets-are-not-read`, kind `hides`.

A required marker drawn by a CSS rule on the label is invisible to this reader, and so is a field a stylesheet has hidden, reordered or shrunk to nothing. The blind example is required on screen and reported as fine.

The blind example below has the problem and nothing is reported for it.

| | File | Findings |
|---|---|---|
| Blind | `limits/css-required-marker.blind.html` | none |
| Contrast | `limits/css-required-marker.contrast.html` | `required-not-programmatic@serious` |

## Nothing here executes JavaScript, so a page is read exactly as the server sent it.

`scripts-are-not-run`, kind `manufactures`.

A name, a required flag or an error message attached at runtime is not seen, and the field is reported as though it never got one. This is the direction that costs a reader time, because the finding is wrong rather than missing.

The blind example below does not have the problem, and a finding is reported anyway. This is a finding you have to know to discard.

| | File | Findings |
|---|---|---|
| Blind | `limits/js-attached-name.blind.html` | `field-without-label@serious` |
| Contrast | `limits/js-attached-name.contrast.html` | none |

## Markup inside a template element is parsed like any other markup.

`template-markup-is-read-as-live`, kind `manufactures`.

A field a script clones out of a template later is read as if it were on the page now, and reported on. The same is true of any markup a framework ships inert.

The blind example below does not have the problem, and a finding is reported anyway. This is a finding you have to know to discard.

| | File | Findings |
|---|---|---|
| Blind | `limits/template-content.blind.html` | `field-without-label@serious` |
| Contrast | `limits/template-content.contrast.html` | none |

## The element tree is the one written in the file, not the one a browser builds from it.

`an-implied-head-is-not-a-head`, kind `hides`.

A browser creates a head element and hoists metadata and scripts into it. This reader does not, so a blocking script written before the body with no head element around it is not found in a head and is not reported.

The blind example below has the problem and nothing is reported for it.

| | File | Findings |
|---|---|---|
| Blind | `limits/implicit-head.blind.html` | none |
| Contrast | `limits/implicit-head.contrast.html` | `blocking-script-in-checkout-head@moderate` |

## PHP and JavaScript are matched as text. Nothing is evaluated and no value is followed.

`source-is-read-not-evaluated`, kind `hides`.

A gateway call made through a callable rather than a named method, and a script handle assembled from two strings, are both invisible. Every pattern in this repository is a pattern over source, and that is the cost of it.

The blind example below has the problem and nothing is reported for it.

| | File | Findings |
|---|---|---|
| Blind | `limits/read-not-evaluated.blind.php` | none |
| Contrast | `limits/read-not-evaluated.contrast.php` | `charge-without-idempotency-key@critical`, `commerce-scripts-on-content-pages@serious` |

## Patterns are tested against single lines, with comments blanked first.

`one-line-at-a-time`, kind `hides`.

A call whose arguments are on the lines below it is matched on the call line only, so an argument that would have decided the finding is not part of what was read. Formatting therefore changes the result, which is the least satisfying property this reader has.

The blind example below has the problem and nothing is reported for it.

| | File | Findings |
|---|---|---|
| Blind | `limits/one-line-at-a-time.blind.php` | none |
| Contrast | `limits/one-line-at-a-time.contrast.php` | `commerce-scripts-on-content-pages@serious` |

## When a check looks for evidence that something was done properly, it looks across the whole file.

`evidence-is-file-scoped`, kind `hides`.

Two charges in one file, one of them carrying an idempotency key, means the keyed call vouches for the unkeyed one. The same shape applies to a signature check, a nonce check and a capture confirmation.

The blind example below has the problem and nothing is reported for it.

| | File | Findings |
|---|---|---|
| Blind | `limits/file-scoped-evidence.blind.php` | none |
| Contrast | `limits/file-scoped-evidence.contrast.php` | `charge-without-idempotency-key@critical` |

## Each file is read on its own. Nothing is followed into another file.

`no-cross-file-reasoning`, kind `manufactures`.

A hook registered conditionally in one file and implemented in another reads as unconditional, and the finding reported against the second file is wrong. Splitting a guard from the thing it guards is ordinary plugin structure, so expect this one.

The blind example below does not have the problem, and a finding is reported anyway. This is a finding you have to know to discard.

| | File | Findings |
|---|---|---|
| Blind | `limits/cross-file-guard.blind.php` | `commerce-scripts-on-content-pages@serious` |
| Contrast | `limits/cross-file-guard.contrast.php` | none |

## A key the store description does not carry is not a finding.

`absent-config-keys-say-nothing`, kind `hides`.

The description is a file an operator fills in by hand, and demanding every key would make an incomplete file look like a broken store. The cost is that an empty section passes, so a clean result on a sparse description means very little.

The blind example below has the problem and nothing is reported for it.

| | File | Findings |
|---|---|---|
| Blind | `limits/absent-config-keys.blind.json` | none |
| Contrast | `limits/absent-config-keys.contrast.json` | `digital-goods-taxed-at-shop-base@serious` |

## No request is made and no page is loaded, so every cost here is read off the source.

`nothing-is-measured`, kind `hides`.

A fragment request placed correctly and cached correctly can still return a quarter of a megabyte on every cart change, and that is invisible. Where a call sits can be read; what it returns cannot.

The blind example below has the problem and nothing is reported for it.

| | File | Findings |
|---|---|---|
| Blind | `limits/runtime-cost.blind.js` | none |
| Contrast | `limits/runtime-cost.contrast.js` | `fragments-not-cached-in-session@moderate`, `fragments-request-in-critical-path@moderate` |
