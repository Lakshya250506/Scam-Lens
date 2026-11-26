# Requirements Document

## Introduction

### Feature: Brand lookalike check in the Scam Lens link inspector

| Field | Value |
|---|---|
| Spec title | Scam Lens – Brand lookalike check for link inspection |
| Problem | `https://sbi-secure-login.xyz/kyc` currently returns "No obvious structural warning". A fake bank address must not look clean. |
| Scope | One new deterministic check inside `inspectLink` in `server.js`, its tests, and the README link bullet and limitations. No new route, no new dependency. |
| Related steering | `.kiro/steering/product.md`: link inspection stays deterministic, makes no network or DNS calls, never claims a link is safe, and uses plain language. |

The check looks only at the text of the hostname. It does not visit the site, resolve DNS or query any reputation service. It is decision support, not proof that a site is fake or genuine.

## Requirements

### Requirement 1: Determinism and scope

**User Story:** As a user who got a suspicious link, I want the same link to always give the same result, so that I can trust the checker is not guessing differently each time.

- REQ-LL-1.1: THE check SHALL run inside `inspectLink` and SHALL use only the submitted URL text.
- REQ-LL-1.2: THE check SHALL NOT make any network or DNS request, SHALL NOT use randomness or the current time, and SHALL NOT call the AI provider.
- REQ-LL-1.3: THE check SHALL NOT add a dependency or `devDependency`, and SHALL NOT add a route.
- REQ-LL-1.4: THE existing findings, the existing risk-level rules, `reputation_check` and `disclaimer` SHALL keep their current text and behaviour.
- REQ-LL-1.5: THE check SHALL NOT word any result as a guarantee that a link is safe.

#### Acceptance Criteria

1. The check runs inside `inspectLink` and uses only the submitted URL text.
2. The check makes no network or DNS request, uses no randomness or current time, and does not call the AI provider.
3. The check adds no dependency, no `devDependency` and no route.
4. The existing findings, the existing risk-level rules, `reputation_check` and `disclaimer` keep their text and behaviour.
5. No result is worded as a guarantee that a link is safe.

### Requirement 2: Hostname preparation

**User Story:** As a user who pastes a link in any form (upper case, with a trailing dot, or with an encoded name), I want it read the same consistent way, so that the formatting alone cannot hide a fake address.

- REQ-LL-2.1: THE check SHALL lower-case the hostname and remove any trailing dot before analysis. `https://SBI-SECURE-LOGIN.XYZ./kyc` SHALL behave like `https://sbi-secure-login.xyz/kyc`.
- REQ-LL-2.2: THE check SHALL split the hostname into labels on `.`, and each label into tokens on `-`, and SHALL compare tokens exactly (no substring or fuzzy matching).
- REQ-LL-2.3: THE check SHALL ignore labels that start with `xn--` when looking for brand or keyword tokens, because a punycode label is encoded text and its letters are not the characters the user sees. The existing punycode finding and its High caution level SHALL still apply to such hosts.
- REQ-LL-2.4: THE check SHALL NOT search the last label (the TLD) for brand tokens, so an address that ends in a brand-owned TLD such as `.sbi` is not treated as a lookalike by that fact alone.
- REQ-LL-2.5: THE check SHALL skip raw IP addresses (the existing raw-IP finding already covers them).

#### Acceptance Criteria

1. The hostname is lower-cased and trailing dots are removed, so `https://SBI-SECURE-LOGIN.XYZ./kyc` gives the same result as `https://sbi-secure-login.xyz/kyc`.
2. The hostname is split into labels on `.` and each label into tokens on `-`, and tokens are compared exactly, with no substring or fuzzy matching.
3. Labels that start with `xn--` are not searched for brand or keyword tokens, and such hosts still get the existing punycode finding and `High caution`.
4. The last label (the TLD) is not searched for brand tokens, so an address that ends in a brand-owned TLD such as `.sbi` is not a lookalike for that reason alone.
5. Raw IP addresses are skipped by the check and keep the existing raw-IP finding.

### Requirement 3: Brand data

**User Story:** As the project owner, I want the brand list kept in one commented place, with every official domain marked for my verification, so that I can check and correct it.

- REQ-LL-3.1: `server.js` SHALL hold the brands in one clearly commented constant. Each entry SHALL have a display `name`, a `kind` (`bank`, `app` or `service`), a list of exact hostname `tokens`, and a list of `officialDomains` (registrable domains).
- REQ-LL-3.2: Every `officialDomains` entry SHALL carry the comment `TO VERIFY BY AUTHOR`. No entry SHALL be added unless the implementer is sure it is official.
- REQ-LL-3.3: THE initial brands SHALL be sbi, hdfc, icici, axis, paytm, phonepe, irctc, uidai, incometax and npci, with the domains listed in `design.md`.
- REQ-LL-3.4: THE suspicious-TLD constant SHALL be `xyz`, `top`, `click`, `icu`, `buzz`. THE sensitive-keyword constant SHALL be `login`, `kyc`, `verify`, `secure`, `update`, `refund`, `claim`, `account`, `support`, `rewards`.

#### Acceptance Criteria

1. `server.js` holds the brands in one clearly commented constant, and each entry has a display `name`, a `kind` (`bank`, `app` or `service`), a list of exact `tokens` and a list of `officialDomains`.
2. Every `officialDomains` entry carries the comment `TO VERIFY BY AUTHOR`, and no domain is listed that the implementer was not sure of.
3. The brands are sbi, hdfc, icici, axis, paytm, phonepe, irctc, uidai, incometax and npci, with the domains listed in `design.md`. **Needs author clarification:** the official domains themselves still need the author's verification.
4. The suspicious-TLD constant is `xyz`, `top`, `click`, `icu`, `buzz`, and the sensitive-keyword constant is `login`, `kyc`, `verify`, `secure`, `update`, `refund`, `claim`, `account`, `support`, `rewards`.

### Requirement 4: Registrable domain

**User Story:** As a user, I want the checker to find the main part of an address correctly for common Indian endings such as `.co.in` and `.gov.in`, so that a genuine site is not mistaken for a fake one.

- REQ-LL-4.1: THE check SHALL compute the registrable domain without a library: the last two labels, or the last three when the second-to-last label is one of `co`, `com`, `org`, `net`, `gov`, `ac`, `edu`, `nic`, `res` and the last label has exactly two letters. Follow-up (REQ-LL-9.1): when the last label is `in`, `bank` and `fin` also count as second-level labels.
- REQ-LL-4.2: THIS simplification SHALL be documented as a limitation (README and code comment). It does not use the Public Suffix List.

#### Acceptance Criteria

1. The registrable domain is the last two labels, or the last three when the second-to-last label is one of `co`, `com`, `org`, `net`, `gov`, `ac`, `edu`, `nic`, `res` and the last label has exactly two letters, computed without a library.
2. When the last label is `in`, `bank` and `fin` also count as second-level labels (REQ-LL-9.1).
3. The README and a code comment describe this rule as a simplification that does not use the Public Suffix List.

### Requirement 5: Rule A, brand impersonation

**User Story:** As a user who got a link that uses a bank's, payment app's or public service's name, I want to be warned when the address is not that organisation's own site, so that I do not log in on a fake page.

- REQ-LL-5.1: Rule A SHALL match a brand when (1) one of its tokens appears in the hostname, AND (2) the registrable domain is not one of that brand's official domains, AND (3) at least one of: (a) a sensitive keyword token is present, (b) the TLD is in the suspicious-TLD constant, (c) a brand token appears in a subdomain label, meaning a label before the registrable domain.
- REQ-LL-5.2: WHEN Rule A matches, THE check SHALL add one finding per matched brand in plain language, for example "This web address uses a bank name (SBI) but does not appear to be that bank's official site. The main part of the address is kyc-update.xyz."
- REQ-LL-5.3: A Rule A match SHALL give the risk level `High caution`, and SHALL NEVER leave the result at "No obvious structural warning".
- REQ-LL-5.4: A host whose registrable domain is an official domain SHALL NOT get a Rule A finding, whatever its subdomains or keywords.
- REQ-LL-5.5: A brand token with no keyword, no suspicious TLD and no subdomain use (for example `sbi-offers.com`) SHALL NOT match. This is a deliberate trade-off to limit false alarms.

#### Acceptance Criteria

1. Rule A matches a brand only when one of its tokens is in the hostname, the registrable domain is not one of that brand's official domains, and at least one of these holds: (a) a sensitive keyword token is present, (b) the TLD is a suspicious TLD, or (c) a brand token is in a subdomain label.
2. Each matched brand adds one plain-language finding that names the brand and the main part of the address.
3. A Rule A match gives `High caution` and never leaves the result at "No obvious structural warning".
4. A host whose registrable domain is one of the brand's official domains gets no Rule A finding, whatever its subdomains or keywords.
5. A brand token with no keyword, no suspicious TLD and no subdomain use (for example `sbi-offers.com`) does not match.

### Requirement 6: Rule B, weaker

**User Story:** As a user, I want a milder warning when an address pairs a login-type word with an uncommon ending, so that I check it carefully even when no brand name is used.

- REQ-LL-6.1: WHEN no Rule A finding was added AND the TLD is in the suspicious-TLD constant AND a sensitive keyword token is present, THE check SHALL add one finding in plain language, for example "This web address pairs the word "login" with an uncommon ending (.xyz). Many fake websites use this pattern."
- REQ-LL-6.2: A Rule B match SHALL give the risk level `Review carefully` unless an existing rule gives `High caution`.

#### Acceptance Criteria

1. When no Rule A finding was added, the TLD is a suspicious TLD and a sensitive keyword token is present, one plain-language Rule B finding is added that names the keyword and the ending.
2. A Rule B finding gives `Review carefully`, unless an existing rule gives `High caution`.

### Requirement 7: Suggestions and display

**User Story:** As a user who has been warned about a link, I want short plain advice on what to do next, so that I know how to reach the real site safely.

- REQ-LL-7.1: WHEN Rule A or Rule B adds a finding, THE check SHALL add one suggestion telling the user not to log in or enter details, and to open the official app or type the official address. It SHALL NOT ask for an OTP, PIN or password.
- REQ-LL-7.2: THE frontend SHALL show the new findings with the existing list renderer (`textContent`). `public/index.html` SHALL NOT need a change.
- REQ-LL-7.3: ALL text shown to users SHALL be plain and non-technical. Brand names, keywords and TLDs shown in findings SHALL come from the fixed constants, and the registrable domain SHALL be inserted only as text.

#### Acceptance Criteria

1. When Rule A or Rule B adds a finding, one suggestion is added telling the user not to log in or enter details, and to open the official app or type the official address.
2. The suggestion does not ask for an OTP, PIN or password.
3. The frontend shows the new findings with the existing list renderer (`textContent`), and `public/index.html` needs no change.
4. Text shown to users is plain and non-technical. Brand names, keywords and TLDs come from the fixed constants, and the registrable domain is inserted only as text.

### Requirement 8: Documentation and tests

**User Story:** As the project owner, I want the check documented with its limits and covered by offline tests, so that readers are not misled and regressions are caught.

- REQ-LL-8.1: `README.md` SHALL describe the check in the link-inspection bullet and SHALL list its limitations (small brand list, simplified registrable domain, exact-token matching, no live check, can be wrong in both directions).
- REQ-LL-8.2: Test counts in `README.md` and `.kiro/steering/*.md` SHALL match the output of `npm test`.
- REQ-LL-8.3: Tests SHALL run offline with no API key and SHALL NOT weaken or remove an existing test. Follow-up exception: REQ-LL-10.1 makes `https://axis-login.xyz` stop matching Rule A, so the axis row of the existing test LL-T12 uses `https://axis-bank-login.xyz` as its fake address. Every other assertion in LL-T12 is unchanged, and no other existing test is edited.

#### Acceptance Criteria

1. `README.md` describes the check in the link-inspection bullet and lists its limitations: a small brand list, a simplified registrable domain, exact-token matching, no live check, and that it can be wrong in both directions.
2. The test counts in `README.md` and `.kiro/steering/*.md` match the output of `npm test`.
3. The tests run offline with no API key, and no existing test is weakened or removed. The one exception is the axis row of LL-T12, which uses `https://axis-bank-login.xyz` because REQ-LL-10.1 stops `axis-login.xyz` matching Rule A.

### Requirement 9: Restricted Indian bank and finance namespaces (follow-up)

**User Story:** As a customer of a bank that uses its RBI-approved `.bank.in` address, I want the real site not to be called a lookalike, so that I can trust the warnings I do see.

#### Context

RBI requires Indian banks to use the restricted `.bank.in` domain, and non-bank financial entities to use `.fin.in`. This is an assumption the author must verify. Before this change, `https://www.sbi.bank.in` had registrable domain `bank.in` and the brand `sbi` in a subdomain, so Rule A condition (c) flagged a genuine address as High caution.

- REQ-LL-9.1: WHEN the last label is `in`, THE registrable-domain rule SHALL treat `bank` and `fin` as second-level labels, so `www.sbi.bank.in` has registrable domain `sbi.bank.in`.
- REQ-LL-9.2: `server.js` SHALL hold a constant `RESTRICTED_NAMESPACES` with the values `bank.in` and `fin.in`, commented "Restricted to RBI-approved entities. Assumption, TO VERIFY BY AUTHOR."
- REQ-LL-9.3: IF the hostname equals one of the namespaces, OR ends with a dot followed by one of them, THEN Rule A SHALL NOT fire for that host. The dot boundary is required: `sbi.fakebank.in` SHALL NOT be exempt.
- REQ-LL-9.4: Rule B and every existing finding SHALL be unaffected by the exemption.
- REQ-LL-9.5: THE brand table SHALL NOT change. No official domain SHALL be added or removed.

#### Acceptance Criteria

1. When the last label is `in`, `bank` and `fin` count as second-level labels, so `www.sbi.bank.in` has registrable domain `sbi.bank.in`.
2. `server.js` holds `RESTRICTED_NAMESPACES` with `bank.in` and `fin.in`, commented "Restricted to RBI-approved entities. Assumption, TO VERIFY BY AUTHOR." **Needs author clarification:** that only RBI-approved entities can register under these namespaces is an assumption the author must still verify.
3. A host that equals a namespace, or ends with a dot followed by one, gets no Rule A finding. `sbi.fakebank.in` is not exempt because the match needs the dot.
4. Rule B and every existing finding are unaffected by the exemption.
5. The brand table is unchanged: no official domain is added or removed.

### Requirement 10: Ordinary-word brand tokens (follow-up)

**User Story:** As a user, I want an ordinary English word that is also a brand name (`axis`) not to trigger a brand warning on its own, so that unrelated sites are not flagged.

- REQ-LL-10.1: THE brand token `axis` SHALL count as a brand match only when the token `bank` also appears in the hostname. THE token `axisbank` SHALL always count. Every other brand token SHALL be unchanged.
- REQ-LL-10.2: THE rule SHALL be held in a small data constant (`AMBIGUOUS_BRAND_TOKENS`, mapping a token to the companion token it needs) and SHALL apply both to "a brand token appears in the hostname" and to Rule A condition (c).
- REQ-LL-10.3: WHEN `axis` does not count, Rule B MAY still apply to the host (for example `https://axis-login.xyz`).

#### Acceptance Criteria

1. The token `axis` counts as a brand match only when the token `bank` is also in the hostname. The token `axisbank` always counts, and every other brand token is unchanged.
2. The rule is held in the data constant `AMBIGUOUS_BRAND_TOKENS`, which maps a token to the companion token it needs, and it applies both to the brand-token test and to Rule A condition (c).
3. When `axis` does not count, Rule B can still apply, for example to `https://axis-login.xyz`.

### Requirement 11: Risk-level safety (follow-up)

**User Story:** As a user, I want the new check never to make an existing serious warning look milder, so that the strongest warning I see stays the strongest.

- REQ-LL-11.1: THE lookalike check SHALL NEVER lower a result that an existing rule rated `High caution`. The embedded-credentials finding and the raw-IP finding SHALL stay present next to any new finding.
- REQ-LL-11.2: A Rule B finding on a host that also has an existing High-caution trigger (for example embedded credentials) SHALL leave the result at `High caution`.
- REQ-LL-11.3: `reputation_check` and `disclaimer` SHALL stay byte-for-byte unchanged.

#### Acceptance Criteria

1. The lookalike check never lowers a result that an existing rule rated `High caution`, and the embedded-credentials and raw-IP findings stay present next to any new finding.
2. A Rule B finding on a host that also has an existing `High caution` trigger (for example embedded credentials) leaves the result at `High caution`.
3. `reputation_check` and `disclaimer` stay byte-for-byte unchanged.

## Overall Acceptance Criteria

These criteria cover the whole spec and keep their original numbers 1 to 13. Tasks in `tasks.md` that cite "Acceptance Criteria N" refer to this list.

1. Each of these gives a `High caution` result with a finding containing "does not appear to be": `https://sbi-secure-login.xyz/kyc`, `https://hdfc-bank-kyc-update.top/login`, `https://sbi.co.in.kyc-update.xyz`, `https://secure-icici-login.com/verify`, `https://paytm.verify-account.click`.
2. Each of these has no Rule A or Rule B finding and keeps "No obvious structural warning": `https://www.sbi.co.in`, `https://onlinesbi.sbi`, `https://www.hdfcbank.com/personal`, `https://www.icicibank.com`, `https://paytm.com`, `https://www.google.com`, `https://example.com`.
3. Upper-case hostnames and a trailing dot give the same result as the plain form.
4. A punycode host still gets the punycode finding and `High caution`. A brand name inside a punycode label is not read as a brand token.
5. For each of conditions (a), (b) and (c) taken alone, Rule A gives `High caution`.
6. `https://secure-login.xyz` gives one Rule B finding and `Review carefully`. `https://login.example.com` and `https://holiday-deals.xyz` give no lookalike finding.
7. `reputation_check` and `disclaimer` are unchanged for every result.
8. `npm test` passes with no API key and the new total is stated in the README and steering files.
9. These get no lookalike finding and stay "No obvious structural warning": `https://www.sbi.bank.in`, `https://login.sbi.bank.in`, `https://axis.bank.in`, `https://www.hdfcbank.bank.in`, `https://www.sbi.bank.in/login`.
10. These are still flagged `High caution` by Rule A: `https://sbi.bank.in.kyc-update.xyz`, `https://bank.in.sbi-login.top`, `https://sbi.fakebank.in`, `https://sbi-bank.in-login.xyz`.
11. `https://axis-login.xyz` gets no Rule A finding (it may get Rule B). `https://axis-bank-login.xyz` and `https://axisbank-login.xyz` get a Rule A finding.
12. `http://user:pass@sbi-secure-login.xyz`, `https://192.168.1.1/sbi-login` and `http://user:pass@secure-login.xyz` stay `High caution`, and the credentials or raw-IP finding is still present.
13. The registrable domain of `www.sbi.bank.in` is `sbi.bank.in`, and of `sbi.fakebank.in` is `fakebank.in`.

## Known limitations (must stay documented)

- The brand list is small and its official domains are marked TO VERIFY BY AUTHOR. A real domain missing from the list can be flagged if its hostname also contains a keyword such as `login`.
- A fake site that does not use a listed brand token, a misspelling (for example `sbbi`) or a lookalike character is not caught by this check.
- Registrable-domain detection is a simplification and is wrong for some country domains.
- Hosts under `bank.in` and `fin.in` are exempt from Rule A on the assumption that only RBI-approved entities can register there (TO VERIFY BY AUTHOR). If that is wrong, a fake address under those namespaces is not caught. Any brand name is exempt there, for example `paytm.fin.in`.
- The word `axis` alone no longer matches, so a fake that uses only `axis` (for example `axis-login.xyz`) is not caught by Rule A. It can still get the weaker Rule B finding.
- The check reads the hostname only. It does not read the path, visit the site or query a reputation database.
- A result is decision support, not proof.

## Out of scope

- Typo-squatting or edit-distance matching, homograph decoding, the Public Suffix List, live reputation lookups, AI use, new routes, changes to the verdict scale.

## Glossary

| Term | Definition |
|---|---|
| Brand token | An exact hostname token listed for a brand in `INDIAN_BRANDS`, for example `sbi` or `hdfcbank`. |
| `disclaimer` | The fixed text field in every `inspectLink` result that says a link without red flags can still be malicious. This spec leaves it unchanged. |
| Finding | One plain-language entry in the `findings` list of an `inspectLink` result. |
| `inspectLink` | The function in `server.js` that inspects the structure of a submitted URL and returns the link-inspection result. |
| Label | One part of a hostname between dots, for example `sbi` in `www.sbi.co.in`. |
| Official domain | A registrable domain listed for a brand in `officialDomains`. Every entry is marked TO VERIFY BY AUTHOR. |
| Public Suffix List | A public list of domain endings under which names are registered. This spec deliberately does not use it. |
| Punycode (`xn--`) | The ASCII encoding of an internationalised hostname label. Labels that start with `xn--` are skipped by the brand check. |
| Registrable domain | The main part of an address that an owner registers, worked out by the simplified rule in Requirement 4, for example `kyc-update.xyz` in `sbi.co.in.kyc-update.xyz`. |
| `reputation_check` | The fixed text field in every `inspectLink` result saying that no live reputation lookup was done. This spec leaves it unchanged. |
| Restricted namespace | `bank.in` or `fin.in`, assumed to be restricted to RBI-approved entities. Hosts inside them are exempt from Rule A. |
| Risk level | The `risk_level` of a link result: `High caution`, `Review carefully` or `No obvious structural warning`. |
| Rule A | The brand-impersonation rule in Requirement 5. A match gives `High caution`. |
| Rule B | The weaker rule in Requirement 6, for an uncommon ending plus a sensitive word with no brand. A match gives `Review carefully`. |
| Sensitive keyword | A hostname token in the keyword constant, for example `login` or `kyc`. |
| Subdomain label | A label before the registrable domain, for example `sbi` and `co` in `sbi.co.in.kyc-update.xyz`. |
| Suspicious TLD | An ending in the suspicious-TLD constant: `xyz`, `top`, `click`, `icu` or `buzz`. |
| TLD | The last label of a hostname, for example `xyz` or `in`. |
| Token | One part of a label between hyphens, for example `secure` in `sbi-secure-login`. |
