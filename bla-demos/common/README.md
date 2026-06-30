# BLA Demo Mock Apps

Four standalone mock **agent consoles** for the CISO Business-Logic-Abuse demos:
**Loyalty, Discount, Shipping, Snooping**. The PixieBrix mod layers on top of each
(the same way it does on Salesforce). These apps deliberately contain **no
guardrail logic** — they render a realistic screen, **allow the risky action**,
and expose the hooks + data the mod needs so PixieBrix is the hero that senses,
warns, and blocks.

## How to run

Double-click any app's `index.html`. No server, build step, or backend is
required — seed data is inlined via each app's `data.js`, so everything works
from `file://`.

Each page loads, in order:

1. `../common/console.css` — shared agent-console styling
2. `../common/pbx-contract.js` — sets up the `window.PBX_DEMO` namespace + helpers
3. its own `data.js` — sets `window.PBX_DEMO.data` (seed data)
4. its own `app.js` — renders the screen and wires the contract

A **Reset** button in each header restores seed state (in-memory only — there is
no persistence).

## Repo layout

```
/bla-demos
  /common
    console.css        # shared "agent console" styling
    pbx-contract.js    # window.PBX_DEMO namespace + event helpers
    README.md          # this file
  /loyalty   { index.html, app.js, data.js }
  /discount  { index.html, app.js, data.js }
  /shipping  { index.html, app.js, data.js }
  /snooping  { index.html, app.js, data.js }
```

---

## The PixieBrix integration contract (all four apps)

The mod must be able to (a) **find** the key fields/buttons, (b) **read** the
correlation data, and (c) **intercept** the risky submit. Every app implements
all four requirements below.

### 1. Stable selectors + data attributes

Every actionable field and button has a stable `id` **and** a `data-pbx-field` /
`data-pbx-action` attribute. Names are fixed per app (tables below) and never
change between renders. No randomized/hashed IDs.

### 2. A documented context object

`window.PBX_DEMO.context` always reflects the **current** state the mod needs to
evaluate a rule. It is updated live on every relevant change. The same values are
mirrored as `data-pbx-*` attributes on the relevant element, so the mod can read
via DOM **or** JS.

### 3. A cancelable "before-action" event

The primary risky action dispatches a **cancelable** `CustomEvent` on `document`
*before* committing, with the full payload in `event.detail`. If a listener calls
`event.preventDefault()` (what the mod does to block), the app **aborts** the
action and leaves state unchanged.

Helper in `pbx-contract.js`:

```js
// returns true if the action should PROCEED (not prevented), false if BLOCKED
PBX_DEMO.dispatchBefore(name, detail);

// non-cancelable notification (e.g. logging)
PBX_DEMO.notify(name, detail);
```

### 4. Mount points for the mod's UI (empty by default)

- `#pbx-overlay-root` — empty div the mod renders modals/banners into.
- `#pbx-audit-root` — empty div the mod renders its audit-log/evidence panel into.
- `[data-pbx-mask]` — wrapper around any field the mod may need to mask
  (PHI/PII). The app renders the value normally; masking is the mod's job.

> **Design rule:** the apps are intentionally "dumb." They expose truth and allow
> the action. Anything that *decides* or *blocks* belongs to the PixieBrix mod.

### Shared `window.PBX_DEMO` API

| Member | Purpose |
|---|---|
| `PBX_DEMO.data` | Seed data (set by each app's `data.js`) |
| `PBX_DEMO.context` | Live snapshot the mod evaluates |
| `PBX_DEMO.dispatchBefore(name, detail) -> bool` | Fire cancelable before-action event |
| `PBX_DEMO.notify(name, detail)` | Fire non-cancelable event |
| `PBX_DEMO.setContext(patch)` | Merge a patch into `context` (used by apps) |
| `PBX_DEMO.onReset(fn)` / `PBX_DEMO.reset()` | Reset plumbing |
| `PBX_DEMO.clone(obj)` | Deep clone helper |

---

## Per-app contract reference

### Loyalty — FQTV Servicing Console (Amadeus Altéa style)

Single console with four servicing actions in the **Servicing** panel (segmented
control): Goodwill, Retro claim, **Points transfer** (default), Redemption. Each
action dispatches the same cancelable event with its own `detail.action`.

**Event (cancelable):** `pbx:beforeSubmit` — returned by `PBX_DEMO.dispatchBefore(...)`;
the app commits (prepends a ledger row, adjusts `balance`, bumps the manual-credits
counter for goodwill/retro-accept) only when it returns `true`.

**Fields / actions (by servicing action):**

| Action | Fields | Submit button |
|---|---|---|
| Goodwill | `#adjust-amount` (`data-pbx-field="points-amount"`), `#adjust-reason` | `#btn-submit-goodwill-adjustment` (`data-pbx-action="goodwill-adjustment"`) |
| Retro claim | `#retro-flight-no`, `#retro-flight-date`, `#retro-reject-reason` | `#btn-accept-retro` / `#btn-reject-retro` (`data-pbx-action="retro-claim"`, `data-decision="accept\|reject"`) |
| Points transfer | `#transfer-recipient` (`data-pbx-field="recipient-account"` + live `data-pbx-recipient-age-days`), `#transfer-amount` (`data-pbx-field="points-amount"`) | `#btn-submit-points-transfer` (`data-pbx-action="points-transfer"`) |
| Redemption | `#redeem-type`, `#redeem-recipient`, `#redeem-recipient-account`, `#redeem-miles` | `#btn-submit-redemption` (`data-pbx-action="redemption"`) |

Other hooks: `#member-search` (`data-pbx-field="member-search"`), manual-credits
counter `#manual-credits-counter` (`data-pbx-field="manual-credits-today"`),
masked co-brand card `<span data-pbx-mask data-pbx-phi="cobrand-card">`.

**Helpers:** `PBX_DEMO.lookupAccount(id) -> { id, ageDays, balance }`; `PBX_DEMO.logSink` (array).

**Context:** `{ action, agentManualCreditsToday, peerBaseline, amount, recipient: { id, ageDays } | null, retro: { matchingFlightExists, daysSinceDeparture, windowMin: 14, windowMax: 180 } }` — updated on input change and action switch.

**Event detail (per action):**
- goodwill → `{ action, amount, reason, agentManualCreditsToday, peerBaseline }`
- retro → `{ action, decision, flightNo, flightDate, matchingFlightExists, daysSinceDeparture, windowMin, windowMax, milesIfAccepted }`
- transfer → `{ action, amount, recipientAccountId, recipientAccountAgeDays, agentManualCreditsToday, peerBaseline }`
- redemption → `{ action, redeemType, recipientType, recipientAccountId, recipientAccountAgeDays, miles }`

**Seeded demo moment:** Console opens on member **VALE / JORDAN** (Gold) already
showing the fraud pattern — a **+75,000** Goodwill credit then a **−75,000**
transfer to `#88231` (ageDays 2), agent at **8** manual credits vs baseline **2**.
The Points-transfer action is pre-filled (`#88231`, 75,000); submitting fires
`pbx:beforeSubmit` and the mod blocks on anomaly + account age.

---

### Discount — `OrderDesk` (order/billing)

**Event (cancelable):** `pbx:beforeApply`

**Fields / actions:**

| Selector | Attribute |
|---|---|
| `#discount-value` | `data-pbx-field="discount-value"` |
| `#discount-mode-toggle` | `data-pbx-field="discount-mode"` → `data-value="pct"\|"amt"` |
| each line row | `[data-pbx-line]` + `data-pbx-product-type` + `data-pbx-unit-price` |
| `#btn-apply-discount` | `data-pbx-action="apply-discount"` |

**Context (= event detail):** `{ agentTierCapPct, targetLine: { type, unitPrice }, discountPct, discountAmt, orderTotalBefore, orderTotalAfter, customerCodesInWindow, hasGiftCardLine }`

**Seeded demo moment:** Apply **90%** to the $250 merch line → app allows; mod
blocks (> tier cap). Apply to the **gift-card** line → mod hard-blocks. Stack
discounts so `orderTotalAfter <= 0` → mod blocks "invalid logic."

#### Checkout → shipping-address step (fraud-address block)

Clicking **CHECKOUT** swaps to an in-page shipping-address view (no navigation,
so it works in embedded/sandboxed frames). The app lets any address through and
only exposes the signal; the PixieBrix layer is what blocks a known-fraud ship-to.

**Event (cancelable):** `pbx:beforeCheckout`

| Selector | Attribute |
|---|---|
| `#ship-name` `#ship-street` `#ship-city` `#ship-state` `#ship-zip` | `data-pbx-field="ship-*"` |
| `#checkout-form` | `data-pbx-known-fraud="true\|false"` + `data-pbx-address-reuse-count` (live) |
| `#btn-place-order` | `data-pbx-action="place-order"` |

**Helper:** `window.PBX_DEMO.lookupFraud(street) -> { street, reuseCount, reason } | null`

**Context:** `context.checkout = { orderId, orderTotal, shippingAddress, knownFraudAddress, addressReuseCount, fraudReason }`

**Event detail:** `{ orderId, orderTotal, shippingAddress, knownFraudAddress, addressReuseCount, fraudReason, customerId }`

**Behavior note:** if the mod calls `preventDefault()` on `pbx:beforeCheckout`,
the app stays on the checkout form and **no order is placed**; otherwise it shows
the order-confirmation view.

**Seeded demo moment:** On checkout, the form defaults to the clean **on-file**
address. Click the **Recent · 14 Maple St** saved-address chip (seeded known-fraud
address: `addressReuseCount: 3`, "linked to 3 prior chargebacks / reshipper") →
`data-pbx-known-fraud="true"`. **PLACE ORDER** with the layer off → order confirms;
with the PixieBrix layer on → `pbx:beforeCheckout` is prevented and the order is blocked.

---

### Shipping — `Consumer Services OMS` (Nike-style)

**Event (cancelable):** `pbx:beforeSave`

**Fields / actions:**

| Selector | Attribute |
|---|---|
| `#ship-name` `#ship-street` `#ship-city` `#ship-zip` | `data-pbx-field="ship-*"` |
| `#order-discount` | `data-pbx-field="order-discount"` |
| `#btn-save-order` | `data-pbx-action="save-order"` |
| order container | `data-pbx-order-status` (`PLACED`/`SHIPPED`) |

**Helper:** `window.PBX_DEMO.lookupAddressReuse(address) -> number`

**Context (= event detail):** `{ orderId, orderStatus, billingAddress, oldShippingAddress, newShippingAddress, billingMismatch, addressReuseCount, discountApplied }`

**Seeded demo moment:** Open **PLACED** order `100247`, change ship-to street to
**14 Maple St** (reuse 3, billing mismatch true), optionally add a discount,
**Save** → app allows; mod blocks + shows before/after diff.

---

### Snooping — Chart Console (Epic Hyperspace style) + mock softphone

Epic-style console: pinned **Storyboard** sidebar + **Chart Review** tab ribbon
(Encounters built; Notes/Labs/Imaging/Meds are stubs). Opens any record with no
friction; the mod enforces reason-for-access, transaction-match, sensitive-list,
and volume rules.

**Events:** `pbx:beforeRecordRender` (cancelable, fires **before** PHI is
populated); `pbx:recordOpened` (non-cancelable, same detail, for logging).

**Elements:**

| Selector | Attribute |
|---|---|
| `#patient-search` | `data-pbx-field="patient-search"` |
| `#search-counter` | `data-pbx-field="search-count-session"` |
| `#patient-chart` | `data-pbx-record-id` `data-pbx-restricted` `data-pbx-transaction-match` (kept current) |
| each PHI value | `[data-pbx-mask]` + `data-pbx-phi="mrn\|dob\|phone\|allergy\|problem\|med\|care-team\|coverage"` |
| `#softphone` | `data-pbx-active-call-patient` + `#btn-start-call` / `#btn-end-call` |

**Helpers:** `PBX_DEMO.lookupPatient(id) -> patient`; `PBX_DEMO.logSink` (array).

**Context:** `{ agentId, searchCountSession, activeCall: { patientId }, openRecord: { id, restricted, transactionMatch }, timeOfDay }`

**Event detail:** `{ recordId, restricted, transactionMatch, searchCountSession, timeOfDay }`

**Behavior note:** A search increments `#search-counter` then opens the record.
On open the cancelable `pbx:beforeRecordRender` fires **before** PHI is populated.
If a listener calls `preventDefault()`, the app renders **chrome only** — the
Storyboard banner (name, age/sex, Restricted badge) and the tab ribbon — and
leaves every `[data-pbx-mask]` PHI slot **empty** (and no encounter rows) for the
mod to gate/reveal. The softphone is the **transaction-match** source (swap point
for Salesforce Service Cloud Voice / Omni-Channel); Start/End call flips
`data-pbx-transaction-match` on the open chart live.

**Seeded demo moment:** With **no active call**, search and open the **restricted**
patient **Riverez, Alex** → `transactionMatch:false, restricted:true`; the mod
gates access (reason-for-access). **Start call** with that patient →
`transactionMatch:true` (legitimate). Running several searches exceeds the session
threshold → the mod soft-blocks.

---

## Cross-app summary

| App | Intercept event (cancelable) | Key context the mod evaluates |
|---|---|---|
| Loyalty | `pbx:beforeSubmit` | per-action `detail.action`; `amount`, `recipientAccountAgeDays`, `agentManualCreditsToday` vs `peerBaseline`, retro `matchingFlightExists`/`daysSinceDeparture` |
| Discount | `pbx:beforeApply` | `discountPct/Amt` vs `agentTierCapPct`, `targetLine.type==giftcard`, `orderTotalAfter<=0`, `customerCodesInWindow` |
| Shipping | `pbx:beforeSave` | `orderStatus==PLACED`, `billingMismatch`, `addressReuseCount`, `discountApplied` |
| Snooping | `pbx:beforeRecordRender` | `transactionMatch`, `restricted`, `searchCountSession`, `timeOfDay` |

## Quick console checks (paste into DevTools)

```js
// inspect live context on any app
PBX_DEMO.context

// simulate the mod BLOCKING the next action on Loyalty
document.addEventListener('pbx:beforeSubmit', e => { console.log(e.detail); e.preventDefault(); });
```
