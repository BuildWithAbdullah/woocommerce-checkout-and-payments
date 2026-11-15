# WooCommerce checkout and payments

The checkout is the one page in a store where a mistake has a price on it. This
repository is a catalogue of the mistakes, a reader that finds them, and a
failing example beside a corrected one for every pattern in it.

It covers four things that go wrong in different ways and get treated as one
subject: the accessibility of the checkout form and the payment methods, what
happens when the gateway declines or times out or redelivers a webhook, the tax
and shipping settings that decide what the shopper is actually charged, and
what the cart fragments mechanism costs on every page of the site.

There are 64 catalogued findings across 8 areas. Every one of them is produced
by a file in this repository, and you can run the thing that produces it.

```
git clone https://github.com/BuildWithAbdullah/woocommerce-checkout-and-payments.git
cd woocommerce-checkout-and-payments
node bin/woo-check.mjs patterns/gateway-retry.before.php
```

```
patterns/gateway-retry.before.php
  critical line   16  charge-without-idempotency-key
           A charge is sent with no idempotency key, so a retried request takes the money twice
           a charge is sent and nothing in this file carries an idempotency key
  critical line   21  timeout-treated-as-decline
           A network timeout is handled as a decline, when a timeout means the outcome is unknown and the money may already be gone
           a timeout at line 21 reaches a failed status at line 22
  serious  line   44  gateway-call-without-timeout
           An HTTP call to the gateway sets no timeout, so a slow gateway holds a PHP worker until the server gives up
           an HTTP call to the gateway sets no timeout

3 findings: 2 critical, 1 serious, 0 moderate, 0 minor
```

Then run the corrected file beside it and get nothing back.

## What it reads

`.php` and `.js` for source, `.html` for rendered markup, `.conf` and
`.htaccess` for server rules, and `.json` for a small description of the store
settings. Point it at a directory and it walks it.

Six of the nine tax and shipping findings are settings rather than code, and no
amount of reading the theme will show you them, so the store description file
exists to carry them. Its format, and every key the checker reads, is in
[docs/store-description.md](docs/store-description.md).

| Exit code | What it means |
|---|---|
| `0` | nothing found |
| `1` | the worst finding is minor or moderate |
| `2` | the worst finding is serious |
| `3` | the worst finding is critical |
| `64` | the arguments did not make sense |

```
woo-check --list                      print the catalogue
woo-check --format json <paths...>    machine readable output
woo-check --help                      the usage
```

## The eight areas

| Area | Findings | What is in it |
|---|---|---|
| `checkout-form` | 12 | Labels, autofill tokens, required state, and how a failed submission is reported back |
| `payment-methods` | 8 | The method choice, the gateway's own iframe, saved cards, and the terms checkbox |
| `gateway-failures` | 11 | Idempotency, webhook signatures and redelivery, timeouts, captures, refunds, and what reaches the log |
| `tax-and-shipping` | 9 | Rounding, the amount sent to the gateway, shipping zones and classes, and where tax is calculated from |
| `cart-fragments` | 6 | Where the fragments script loads, what it costs, and what the cart cookie does to the page cache |
| `script-footprint` | 6 | Which pages pay for the commerce bundles, and gateway libraries loaded for gateways nobody can use |
| `order-flow` | 6 | Work done on the order received page, stock timing, status transitions, and whose order is on screen |
| `coupons-and-prices` | 6 | Usage limits, discount order, money arithmetic, and currencies that do not have two decimal places |

The full list, with the severities each finding can be emitted at and the
example that produces it, is generated into
[docs/every-finding.md](docs/every-finding.md) from the catalogue itself.

## One entry per reason, not one per check

The catalogue is a list of reasons a checkout can be wrong. Two checks that
fail for the same reason share an entry, and one check that can fail for three
different reasons gets three entries.

That sounds like bookkeeping and it is the single most productive rule in this
repository. Writing a catalogue this way means writing a fixture for every
reason, and writing fixtures is what turns up the reasons the checker gets
wrong. Several of the findings below exist because a fixture written for one of
them produced something else.

## Exact sets, in both directions

Every example in this repository declares the **exact set** of findings it
produces, as `id@severity`, and the suite compares that set in both directions.

The alternative, asserting that the declared findings are among the ones
produced, is worse than it looks. Under containment a file can emit any number
of findings it has not declared and still pass, so **every false positive the
corpus triggers is invisible by construction.** Exact set equality is what
found the three false positives in this repository that are described below.
Each one was in a corrected example that still reported something, which under
containment would have been a pass.

The same applies to severities. Each finding declares the complete set of
severities it can be emitted at, and both directions are checked: a severity a
real run produces that is not declared fails the build, and **a severity
declared that no example in the repository has ever produced fails the build
too.** The second direction is the one that does the work, because it refuses
to let the catalogue make a promise the corpus does not keep.

## What it cannot see

A reader that does not say what it misses is worth less than one that does, so
there are 10 declared limits, each with two files beside it: a blind example
where the limit shows, and a contrast example where the same checker gets the
same subject right. Both sets are asserted exactly.

They come in two kinds and the difference matters. Seven **hide** a problem:
the blind example has the fault and nothing is reported. Three
**manufacture** a finding: the blind example does not have the fault and
something is reported anyway, which is a finding you have to know to discard.

The worst of the second kind is the honest one to lead with: **a guard in one
file and the thing it guards in another reads as unguarded**, and splitting
them is ordinary plugin structure, so expect it. The rest, including the fact
that no stylesheet is read and no script is run, are in
[docs/what-the-checkers-cannot-see.md](docs/what-the-checkers-cannot-see.md),
which is generated from the limits manifest so it cannot drift from what the
code does.

## The defects this repository shipped and then found

Seven, every one reproduced by a test before being fixed, and every one found
by writing the corpus rather than by reading the code.

**The payment radio check reported every store that worked.** It gathered every
radio with the word payment in its name and demanded they all share one name
attribute. A store that offers a method choice and a list of saved cards has
two radio groups on purpose. The check now reads the radios inside the payment
methods list, which is the set that are genuinely alternatives to each other.
Found because a corrected example still reported something.

**The payment list was not recognised when it was a fieldset.** The container
was matched on `ul`, `ol` and `div`, and a group of radios belongs in a
fieldset, which is what this repository's own corrected examples use. So the
two checks that read that list silently skipped the best version of the
markup.

**A label made of a brand logo was reported as having no name.** The text of an
element was read by stripping tags, and an image contributes its alternative
text to the name of whatever contains it. `<label><img alt="Visa"></label>` has
the name Visa in a browser and had no name here.

**A saved card was reported twice.** The class pattern matched both
`saved-cards` on the list and `saved-card` on the row, so the wrapper and the
row each reported the first card. The check now walks the token radios
themselves.

**`floor( $total * 100 ) / 100` was reported as a gateway amount in assumed
minor units.** Multiplying by a hundred and dividing by it again on the same
line is scaling for a rounding step. The finding was wrong; the `floor` on
that line is a real finding and is still reported.

**A leaked card number was reported twice, once at the line that fetched the
logger.** `wc_get_logger()` was in the list of log calls. It is a factory.

**A single wrong timeout path produced four findings.** Any honest handling of
a timeout mentions the word several times, and each mention was looked at
separately. It is now reported once per file.

## Verifying

Nothing here asks you to take its word for anything. Every number this README
states is checked against the thing it describes, as a whole line, and a number
that has been allowed to wrap onto two lines fails the same way a wrong one
does.

```
npm test                            497 tests
node tools/verify.mjs               55 repository assertions
node tools/exit-codes.mjs           the real binary over every artefact
node tools/audit-verdicts.mjs       the real checkers through both output modes
node tools/entry-thin.mjs           the entry point is still wiring
node tools/count-tests.mjs          the test count, the same on every version
npm run docs:check                  the generated documents are current
```

There are 15 pattern pairs and 9 fixtures, and the suite drives every one of
them twice: once through the library and once by spawning the real binary.

`tools/exit-codes.mjs` runs the installed binary over every artefact in the
repository, in both output modes, directly and **through a symlink**, and
derives the expected exit code from the manifests rather than from a list kept
inside the tool. The symlink is not decoration: npm installs a `bin` as a
symlink, and a main module guard that compares an unresolved `process.argv[1]`
against `import.meta.url` matches nothing through one, so the binary prints
nothing and exits 0 while every test passes.

`tools/verify.mjs` is a fixed list of named claims rather than a counter. An
assertion made once per file is a count of how many files the repository has,
not a count of what has been checked, so the total is the length of the list.
The suite proves it by adding an unrelated document, an extra source module and
a stray lockfile and requiring the total to stay the same while still failing
on the one that is genuinely wrong.

The counts are not comparable with other repositories that count assertions
per file. Judge the depth by the test count and the size of the catalogue.

## Requirements

Node 20.18.1 or newer, and nothing else. There are no dependencies, which is
deliberate: it means a red build is about this repository and not about
somebody else's release. CI runs the suite on 20.18.1, 22.23.4 and 24.11.1,
checks that the declared floor installs with engine checking on, and has a job
that raises the floor above the runtime to prove the refusal actually happens.
PHP 8.3 lints every PHP example.

## Patterns only

Every example here is written for this repository. There is no code from
delivered work in it, no names, and no domains that anybody owns. Every host in
the examples is a documented example domain, a reserved test name, or the
public URL of a payment library, and that is asserted rather than promised.

## Licence

MIT. Take any of it.
