# The store description file

Six of the nine findings in the tax and shipping area are not in anybody's
theme. They are settings, and no amount of reading the PHP will show you them.
So this repository reads a small JSON file describing the settings instead, and
`patterns/store-settings.before.json` and `patterns/store-settings.after.json`
are a worked pair of it.

The file is something an operator fills in by hand, or exports from their own
tooling. **Every key is optional.** A key that is absent is not a finding, and
that is a deliberate decision with a cost: an empty description passes, so a
clean result on a sparse file means very little. It is recorded as a declared
limit, `absent-config-keys-say-nothing`, with two files beside it.

## The shape

```json
{
  "description": "free text, ignored",
  "sells_digital_goods": true,

  "tax": {
    "based_on": "shipping",
    "prices_include_tax": true,
    "digital_tax_location": "customer",
    "zero_rate_handling": "zero_rate",
    "rounding": "per_total"
  },

  "shipping": {
    "classes": ["bulky", "fragile", "letter"],
    "free_shipping": {
      "min_amount": 50,
      "before_discount": false
    },
    "zones": [
      {
        "name": "United Kingdom",
        "regions": ["GB"],
        "methods": [
          {
            "type": "flat_rate",
            "calculation_type": "class",
            "class_costs": { "bulky": 12, "fragile": 8, "letter": 2 }
          }
        ]
      },
      {
        "name": "Everywhere else",
        "rest_of_world": true,
        "regions": ["*"],
        "methods": [
          {
            "type": "flat_rate",
            "calculation_type": "class",
            "class_costs": { "bulky": 60, "fragile": 40, "letter": 12 }
          }
        ]
      }
    ]
  }
}
```

## Every key the checker reads

| Key | What it is | What is checked |
|---|---|---|
| `sells_digital_goods` | `true` when the catalogue includes downloadable goods | Turns on the digital tax location check. Without it, a shop base location is not a finding, because a shop with no digital goods is entitled to one |
| `tax.based_on` | `shipping`, `billing` or `base` | `billing` on a store with shipping zones is a finding: the goods are taxed where the invoice goes rather than where they arrive |
| `tax.prices_include_tax` | Whether displayed prices are gross | Read, and reported on only in combination with what the PHP sends to the gateway |
| `tax.digital_tax_location` | `customer` or `base` | `base` is a finding on a store that sells digital goods |
| `tax.zero_rate_handling` | `zero_rate` or `exempt` | `exempt` is a finding: the same figure on the invoice and a different line in the return |
| `tax.rounding` | `per_line` or `per_total` | Read. The rounding finding comes out of the PHP, because that is where it actually happens |
| `shipping.classes` | The names of the shipping classes | Used to decide whether a per order cost across classes can undercharge |
| `shipping.zones[].name` | A label, used in the finding text | Nothing on its own |
| `shipping.zones[].regions` | The regions the zone covers. `*` means everywhere else | A set of zones with no catch all is a finding |
| `shipping.zones[].rest_of_world` | `true` on the zone that catches everything else | Satisfies the catch all requirement, same as a `*` region |
| `shipping.zones[].methods[].type` | `flat_rate`, `free_shipping`, `local_pickup` | Only `flat_rate` is read |
| `shipping.zones[].methods[].calculation_type` | `class` or `order` | `order` with two or more classes and per class costs is a finding |
| `shipping.zones[].methods[].class_costs` | Cost per shipping class | Read with `calculation_type` |
| `shipping.free_shipping.min_amount` | The threshold for free shipping | Read with the next key. A threshold with no amount is not judged |
| `shipping.free_shipping.before_discount` | `true` when the threshold is tested before coupons | `true` is a finding: a coupon that drops the basket below the threshold still gets free shipping |

A key the checker does not read is ignored rather than rejected, so you can
keep whatever else you find useful in the same file.

## Running it

```
woo-check path/to/store.json
```

A file that is valid JSON but is not a store description, for example a
`package.json` that happens to be in the directory you pointed at, produces
nothing rather than a pile of nonsense. So does a file that is not valid JSON
at all. Both cases have tests.
