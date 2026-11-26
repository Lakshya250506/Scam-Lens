# Design Document

## Overview

Add `checkBrandLookalike(hostname)` to `server.js`, called from `inspectLink`. It returns `{ findings, high }`. `inspectLink` appends the findings and uses `high` in the existing risk-level expression. Nothing else in the response changes.

```
inspectLink(input)
  ├─ existing checks (credentials, HTTP, punycode, raw IP, shortener, lengths, encoded chars)
  ├─ checkBrandLookalike(hostname)      <- new, pure, no I/O
  │     prepare host → labels → tokens → registrable domain → Rule A → Rule B
  ├─ suggestions (existing, plus one new line when a lookalike finding exists)
  └─ risk level: High caution if existing high-caution finding OR lookalike.high
```

## Architecture

```
public/index.html ── POST /api/check-link ── inspectLink(input)            server.js
                                               parse URL, hostname lower-cased
                                               existing structural checks → findings
                                               checkBrandLookalike(hostname) → { findings, high }
                                                  getRegistrableDomain(labels)
                                                  RESTRICTED_NAMESPACES, ALL_OFFICIAL_DOMAINS → skip Rule A
                                                  INDIAN_BRANDS, AMBIGUOUS_BRAND_TOKENS → Rule A
                                                  LOOKALIKE_KEYWORDS, LOOKALIKE_SUSPICIOUS_TLDS → Rule A (a)(b), Rule B
                                               risk level: High caution if lookalike.high or an existing pattern
                  ◄── JSON result ── fillList (textContent) in public/index.html
```

Everything runs inside `inspectLink` on the submitted text. There is no network, DNS or AI call. The frontend is unchanged.

## Components and Interfaces

| Component | Signature or form | Role |
|---|---|---|
| `inspectLink` | `inspectLink(input) → result` | Existing. Parses the URL, runs the structural checks and the lookalike check, and returns the result object (see Data Models). |
| `checkBrandLookalike` | `checkBrandLookalike(rawHostname) → { findings, high }` | Applies Rule A and Rule B to one hostname. Returns an empty result for an empty host or an IP address. |
| `getRegistrableDomain` | `getRegistrableDomain(labels) → string` | The simplified registrable-domain rule. Exported for tests only. |
| Constants | `INDIAN_BRANDS`, `LOOKALIKE_KEYWORDS`, `LOOKALIKE_SUSPICIOUS_TLDS`, `REGISTRABLE_SECOND_LEVELS`, `IN_RESTRICTED_SECOND_LEVELS`, `RESTRICTED_NAMESPACES`, `AMBIGUOUS_BRAND_TOKENS`, `LOOKALIKE_KIND_TEXT` | Described in "Data constants" below. |
| `ALL_OFFICIAL_DOMAINS` | `Set` of every `officialDomains` entry | Added later by `.kiro/specs/hardening-and-evidence/` after property test P4a. A host under any listed official domain skips Rule A. |
| `/api/check-link` | `POST`, body `{ url }` | Existing route. Returns the `inspectLink` result. |

## Data Models

This spec adds no persistent data and no new API fields. The shapes it uses are:

- `INDIAN_BRANDS` entry: `{ name: string, kind: 'bank' | 'app' | 'service', tokens: string[], officialDomains: string[] }`, for example `sbi: { name: 'SBI', kind: 'bank', tokens: ['sbi', 'onlinesbi'], officialDomains: ['sbi.co.in', 'onlinesbi.sbi', 'bank.sbi', 'onlinesbi.com'] }`.
- `checkBrandLookalike` result: `{ findings: string[], high: boolean }`. `high` is true only when Rule A matched.
- `inspectLink` result (existing fields, unchanged): `{ submitted_url, normalized_url, hostname, risk_level, findings, suggestions, reputation_check, disclaimer }`. The new findings and the one new suggestion are added to the existing `findings` and `suggestions` arrays.

## Error Handling

This spec adds no new failure modes. `checkBrandLookalike` does not throw. It returns an empty result for an empty host or an IP address. Invalid input is handled as before: `inspectLink` throws "Please enter a URL.", "The URL is too long.", "Only HTTP and HTTPS URLs are supported." or "The URL does not contain a valid hostname.", or the parser's own error for an unparseable URL, and `/api/check-link` returns that message with status 400.

## Correctness Properties

Properties 1 to 3 are also generated tests in `tests/properties.test.js` (seed 20261122, added by the hardening-and-evidence spec). The rest are example-based tests in `tests/server.test.js`.

Property 1: For any input that `inspectLink` does not reject, the risk level is one of the three allowed values, `reputation_check` and `disclaimer` are unchanged, two calls give equal results, and a non-empty `findings` list never gives "No obvious structural warning" (P3; LL-T13, LL-T14, LL-T25).
**Validates: Requirements 1.4, 5.3, 11.3**

Property 2: For any listed brand except `axis` and any subdomain labels in front of one of its official domains, the host gets no Rule A finding (P4a; LL-T2, LL-T11, LL-T12, HE-T13).
**Validates: Requirements 5.4**

Property 3: For every brand token, sensitive keyword and suspicious TLD, `<token>-<keyword>.<tld>` gets a Rule A finding and "High caution" (P4b; LL-T1, LL-T7, LL-T21).
**Validates: Requirements 5.1, 5.3**

Property 4: An upper-case hostname or a trailing dot gives the same result as the plain form (LL-T4, LL-T5).
**Validates: Requirements 2.1**

Property 5: Only exact tokens count, and a brand token with no other warning sign is not flagged (LL-T8, LL-T10).
**Validates: Requirements 2.2, 5.5**

Property 6: Punycode hosts keep the punycode finding and "High caution", and encoded labels are not read as brand tokens (LL-T6).
**Validates: Requirements 2.3**

Property 7: Rule B gives "Review carefully" and never lowers a result that an existing rule rated "High caution" (LL-T9, LL-T24).
**Validates: Requirements 6.1, 6.2, 11.2**

Property 8: Hosts inside `bank.in` and `fin.in` get no Rule A finding, the match needs a dot boundary, and lookalike use of those names is still flagged (LL-T15, LL-T16, LL-T17, LL-T18).
**Validates: Requirements 9.1, 9.3**

Property 9: `axis` counts only with `bank`, `axisbank` always counts, and other brands are unaffected (LL-T19, LL-T20, LL-T21).
**Validates: Requirements 10.1, 10.3**

Property 10: The credentials and raw-IP findings stay next to any new finding, with "High caution" (LL-T22, LL-T23).
**Validates: Requirements 11.1**

Property 11: A Rule A finding uses the plain wording and names the main part of the address, and the new suggestion is added (LL-T3).
**Validates: Requirements 5.2, 7.1**

## Testing Strategy

Automated, offline, with no API key (`npm test`, latest run 155 tests in total). For this spec: `tests/server.test.js` (98 tests in total) holds the existing `inspectLink` tests IL-T1 to IL-T9 (9), this spec's LL-T1 to LL-T25 (25) and the regression HE-T13 (1). `tests/properties.test.js` (5 tests) includes P3, P4a and P4b, which cover this check. The "Testing" section at the end of this file lists what the LL tests check.

Manual: none needed for the behaviour itself. **Needs author clarification:** the official domains in `INDIAN_BRANDS` and the assumption that `bank.in` and `fin.in` are restricted to RBI-approved entities still need the author's verification.

## Data constants (server.js, one commented block)

| Constant | Contents |
|---|---|
| `INDIAN_BRANDS` | Brands below. Every `officialDomains` entry is commented `TO VERIFY BY AUTHOR`. |
| `LOOKALIKE_KEYWORDS` | login, kyc, verify, secure, update, refund, claim, account, support, rewards |
| `LOOKALIKE_SUSPICIOUS_TLDS` | xyz, top, click, icu, buzz |
| `REGISTRABLE_SECOND_LEVELS` | co, com, org, net, gov, ac, edu, nic, res |
| `IN_RESTRICTED_SECOND_LEVELS` | bank, fin (second-level labels used only when the last label is `in`) |
| `RESTRICTED_NAMESPACES` | bank.in, fin.in. Commented "Restricted to RBI-approved entities. Assumption, TO VERIFY BY AUTHOR." |
| `AMBIGUOUS_BRAND_TOKENS` | axis needs the companion token bank |
| `LOOKALIKE_KIND_TEXT` | Wording for `bank`, `app` and `service` |

### Brands and official domains (to be verified by the author)

| Key | Display name | Kind | Tokens (exact) | Official registrable domains |
|---|---|---|---|---|
| sbi | SBI | bank | sbi, onlinesbi | sbi.co.in, onlinesbi.sbi, bank.sbi, onlinesbi.com |
| hdfc | HDFC Bank | bank | hdfc, hdfcbank | hdfcbank.com |
| icici | ICICI Bank | bank | icici, icicibank | icicibank.com |
| axis | Axis Bank | bank | axis, axisbank | axisbank.com |
| paytm | Paytm | app | paytm | paytm.com |
| phonepe | PhonePe | app | phonepe | phonepe.com |
| irctc | IRCTC | service | irctc | irctc.co.in |
| uidai | UIDAI (Aadhaar) | service | uidai | uidai.gov.in |
| incometax | Income Tax Department | service | incometax, incometaxindia | incometax.gov.in, incometaxindia.gov.in |
| npci | NPCI | service | npci | npci.org.in |

Only domains the implementer is confident about are listed. Others (for example group companies, older or regional domains) are left out on purpose. The author must confirm each row.

## Algorithm

1. `host` = hostname lower-cased, trailing dots removed. Return no findings if empty or if `net.isIP(host)`.
2. `labels` = `host.split('.')`. `tld` = last label.
3. `registrable` = last three labels when `labels.length > 2`, `tld` has two letters and the second-to-last label is in `REGISTRABLE_SECOND_LEVELS`, or `tld` is `in` and the second-to-last label is in `IN_RESTRICTED_SECOND_LEVELS` (`bank`, `fin`). Otherwise the last two labels (or the whole host if there are fewer).
3a. `restricted` = `host` equals a `RESTRICTED_NAMESPACES` entry or ends with `"." + entry`. Because of the dot, `sbi.fakebank.in` is not restricted.
4. `hostTokens` = tokens (split on `-`) of every label except the TLD, skipping labels that start with `xn--`.
5. `subTokens` = same, for the labels before the registrable domain only.
6. `keyword` = first token of `hostTokens` that is in `LOOKALIKE_KEYWORDS`. `badTld` = `tld` is in `LOOKALIKE_SUSPICIOUS_TLDS`.
7. Rule A is skipped completely when `restricted` is true. Otherwise, for each brand in table order: a brand token "counts" when it is in `hostTokens` and, if it is in `AMBIGUOUS_BRAND_TOKENS`, its companion token (`bank` for `axis`) is also in `hostTokens`. Skip unless a brand token counts. Skip if `registrable` is in `officialDomains`. Match if `keyword` or `badTld` or a counting brand token is in `subTokens`. Each match adds one finding and sets `high`.
8. Rule B: if no brand matched and `badTld` and `keyword`, add one finding. `high` stays false.

## Decisions

- **Severity.** Rule A gives High caution, Rule B gives Review carefully. A brand name on an unofficial domain with another warning sign is the strongest signal this check has, and Rule B is explicitly the weaker one. The existing High caution rule is a regular expression over finding text. The new code uses a boolean instead of adding a second pattern to that expression, so the existing rule is untouched.
- **Exact token match.** `sbi` does not match `sbicard` or `lesbian`. This avoids false alarms from substring matches. The cost is that `sbbi`, `s-b-i` and similar misspellings are missed.
- **A brand token alone does not match.** `sbi-offers.com` is not flagged. Flagging every unofficial domain that contains a brand token would flag many fan, news and review sites.
- **TLD not searched for brands.** `.sbi` is a brand-owned TLD. Without this rule, any address under it would count as containing the brand.
- **Punycode labels skipped.** The letters of an encoded label are not what the user sees. The existing punycode finding already gives High caution.
- **Registrable domain simplification.** The Public Suffix List is a dependency or a large data file, and the requirement is no library. The simplified rule handles `.co.in`, `.gov.in`, `.org.in` and similar. It mishandles some country domains, so it can produce a wrong "main part of the address" or a wrong match.
- **Restricted namespaces (follow-up).** Genuine `www.sbi.bank.in` was flagged because `bank.in` looked like an unrelated registrable domain with the brand in a subdomain. Two changes fix it. The registrable-domain rule now treats `bank` and `fin` as second-level labels under `.in`, so the main part of such an address is `sbi.bank.in`. Rule A is also skipped for any host inside `bank.in` or `fin.in`, because the brand table cannot list every bank's `.bank.in` name and the author does not want guessed domains added. With the exemption in place, the first change has no visible effect on Rule A results. It keeps the helper correct (and testable) on its own. The exemption uses a dot boundary, so `sbi.fakebank.in` stays checked. The assumption that only RBI-approved entities can register in these namespaces is for the author to verify.
- **Ordinary-word brand (follow-up).** `axis` is also an English word. It now counts only with `bank` in the hostname. `axisbank` always counts. This costs the catch for `axis-login.xyz`, which still gets Rule B. The rule is data (`AMBIGUOUS_BRAND_TOKENS`) so another word can be added later without new code.
- **Risk safety (follow-up).** The new code never writes the risk level directly. It only adds findings and the boolean `high`, which can only raise the level. The existing credentials, punycode and raw-IP pattern still decides `High caution` on its own, so a Rule B finding cannot lower it.
- **Findings text.** Display name, keyword and TLD come from fixed constants. The registrable domain comes from the user's URL and is shown only through the existing `fillList` (`textContent`).

## Registrable-domain edge cases that are not handled

The rule is still a simplification. These are known and unchanged:

- Second-level labels outside the list give the wrong main domain: `or.jp`, `ne.jp`, `go.jp`, `nhs.uk`, and Indian `gen.in`, `firm.in`, `ind.in`, `mil.in`, `ernet.in`. For example `sbi.mil.in` is read as registrable `mil.in`.
- Shared hosting suffixes such as `blogspot.com` or `github.io` are treated as ordinary domains, so every customer site shares one registrable domain.
- `bank` and `fin` count as second-level labels only under `.in`. `bank.uk`-style hosts are read with the generic rule.
- The word `bank` in `axis-river-bank.xyz` still lets `axis` count, because the companion token is only required to be somewhere in the hostname.
- The exemption covers any brand name inside `bank.in` or `fin.in`, including a brand that does not belong there (for example `paytm.fin.in`).
- Internationalised hosts with `xn--` labels are skipped for brand matching, so a brand inside an encoded label is not seen.

## Alternatives considered

| Option | Why not |
|---|---|
| Public Suffix List package | Adds a dependency (not allowed). |
| Edit distance or typo-squat matching | More false alarms, harder to explain in plain language. |
| Decoding punycode and mapping look-alike characters | Needs a confusables table. Out of scope. |
| AI classification of the hostname | Link inspection must stay deterministic. |
| Searching for brand substrings | Flags unrelated words. |

## Wording

- Rule A: "This web address uses a bank name (SBI) but does not appear to be that bank's official site. The main part of the address is kyc-update.xyz." Payment apps say "a payment app name" and "that app's official site". Services say "the name of an Indian government or public service" and "that service's official site".
- Rule B: "This web address pairs the word "login" with an uncommon ending (.xyz). Many fake websites use this pattern."
- Suggestion: "Do not log in or enter any details on this page. Open the official app, or type the official website address yourself."

## Frontend

`/api/check-link` returns the same fields as before. `public/index.html` renders `findings` and `suggestions` with `fillList`, which uses `textContent`. No change is needed.

## Files changed

| File | Change |
|---|---|
| `server.js` | New constants, `getRegistrableDomain`, `checkBrandLookalike`, two small edits in `inspectLink`. Follow-up: restricted-namespace and ordinary-word constants, and `getRegistrableDomain` added to the test-only exports |
| `tests/server.test.js` | New `describe` block of lookalike tests. Follow-up: a second `describe` block. Existing tests unchanged except the axis row of LL-T12 (see REQ-LL-8.3) |
| `README.md` | Link bullet, limitations, test counts |
| `.kiro/steering/structure.md`, `tech-stack.md` | Test counts |
| `.kiro/specs/link-lookalike/*` | This spec |

## Testing

Offline, no key. The tests call `inspectLink` directly and check findings, risk level, the unchanged `reputation_check` and `disclaimer`, normalisation (upper case, trailing dot, punycode), each of conditions (a), (b) and (c) alone, Rule B, and every brand and official domain in the table.

Follow-up tests (block "inspectLink restricted namespaces, axis and risk safety"): genuine `bank.in` addresses are clean, look-alike use of `bank.in` is still flagged, `axis` needs `bank`, risk-level safety (credentials, raw IP, Rule B plus credentials), unchanged `reputation_check` and `disclaimer`, and a direct test of `getRegistrableDomain` (exported for tests only).
