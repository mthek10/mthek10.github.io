# Pilot Hypercare

A single-page analyser for compliance-pilot activity exports. It reads the events and
spans CSVs, scopes every row to a named person, matches it against a catalogue of
controls, and renders an agent × use-case matrix showing which controls have actually
fired for whom.

It is a static page. No build step, no server, no dependencies — put it on GitHub Pages
and it works.

## It ships empty

The page contains no roster, no catalogue and no data. All three are supplied at run
time, which is what makes it safe to host publicly:

| What | Where it comes from | Where it lives |
|---|---|---|
| Pilots, rosters, catalogue | a snapshot, or a `config.json` you load | IndexedDB, per browser |
| Activity rows | that same snapshot, or CSV exports you load | IndexedDB, per browser |

Nothing is transmitted anywhere. There is no backend, no analytics and no network call
except the fonts. A snapshot file is the only way data moves between machines, and
exporting one is a deliberate act.

## Starting

**Load one file.** A snapshot carries the configuration and the accumulated rows
together, so it is the whole starting state — open the page, click **Load snapshot**,
pick the file, done. The same button also accepts a configuration on its own, for
someone starting with no data yet; you do not have to know which kind you were handed.

## Deploying

1. Put `index.html` (and optionally `config.example.json`) in a repository.
2. Settings → Pages → deploy from branch.
3. Open the URL. You get the setup screen; load a snapshot (or a bare configuration)
   and you are running.

`.nojekyll` is included so GitHub Pages serves the files as-is.

### Should the configuration be committed?

`config.json` is in `.gitignore` by default, because a roster is a list of real people
with real work addresses and a public Pages site is readable by anyone with the URL.
With it ignored, each person loads the configuration themselves — once per browser,
and it sticks.

If your repository is private, or the configuration contains nothing you mind
publishing, drop the `.gitignore` line and commit it. A served `config.json` is picked
up automatically and everyone gets it without any setup step.

The two can coexist. A configuration loaded by hand wins over a served one, **unless**
the served file's `version` is higher — so a deployment can push an update without
silently overwriting someone's local setup.

## Loading data

The **Load export** button (or dropping files anywhere on the page) accepts the two
activity CSVs. File type is decided by the header row, not the filename:

- **events** — needs `event_type` and `occurred_at`. Also reads `event_id`, `email`,
  `url`, `domain`, `policy`, and `data` (a JSON blob).
- **spans** — needs `parent_span_id` and `focused_ms`. Also reads `trace_id`, `span_id`,
  `email`, `started_at`, `ended_at`, `kind`, `name`, `domain`, `hostname`, `idle_ms`,
  `active_input_ms`, `activity_level_pct`, `classification`, `policy`.

Rows are scoped by **email address**, never by policy id — mod-generated events often
ship with an empty policy column, so a policy filter silently drops controls that do
have data. Every address a person uses goes in their `emails` array.

**Exports are merged, not replaced.** An event already held is skipped by `event_id`;
a span still open at export time is extended by the next export. A run of partial
exports therefore accumulates into something no single export contains — which is why
you can load a narrow export without losing history, and why snapshots exist.

## Snapshots

**Data → Export snapshot** writes a JSON file containing every accumulated row plus the
configuration that gives it meaning. Because it carries both, it is also the fastest way
to onboard someone: they load that single file and are looking at exactly what you are.

Use one to move a working set to another machine, hand a colleague the history without
re-uploading gigabytes of CSV, or keep a checkpoint before clearing.

A snapshot contains real activity data and, usually, a real roster. Treat it like the
export it came from — it is in `.gitignore` for that reason.

## Configuration reference

```jsonc
{
  "version": 1,                    // bump to push an update to deployed clients
  "title": "Pilot Hypercare",
  "subtitle": "Compliance pilot control",
  "adminBase": "https://app.pixiebrix.com/teams",   // optional; builds the header links
  "timezones": [{ "id": "UTC", "label": "UTC" }],   // the Days selector
  "heartbeat": {                   // optional; traffic that means only "browser was on"
    "eventTypes": ["custom"],      // dropped from matching, counted as liveness
    "label": "Heartbeat from an unrelated product"
  },
  "pilots": [ /* see below */ ]
}
```

### Pilot

| Field | Meaning |
|---|---|
| `id` | Stable key. **Loaded rows are stored under it — changing it orphans data.** |
| `name`, `client` | Display only |
| `status` | `active` renders the matrix; anything else shows a placeholder with `soonNote` |
| `team`, `policy`, `deployment` | Ids used to build admin links from `adminBase` |
| `doc` | Scoping document URL for the header button |
| `targetExt` | Expected extension version; agents below it raise a readiness finding |
| `roster`, `catalog` | Arrays, below |

### Roster entry

```jsonc
{
  "id": "p1",                      // unique within the pilot
  "name": "Avery Stone",
  "lob": "Tier 1", "group": "T1", "site": "Example City",
  "emails": ["avery@example.invalid"],   // every address this person emits under
  "shift": "09:00 – 17:00",              // optional, display only
  "ready": { "login": 1, "ext": "3.3.1", "mod": "1.0.0" }
}
```

`group` is what a use case's `groups` array matches against. A control not assigned to
someone's group renders as "not assigned" and is excluded from their coverage
denominator.

### Use case

| Field | Meaning |
|---|---|
| `id`, `name` | `id` shows in the column header |
| `enforcement` | A string, or `{ "def": "Mask", "by": { "T2": "Soft Block" } }` per group |
| `system`, `impl` | Display only |
| `groups` | Which roster groups this applies to |
| `status` | `live`, `hold` (blocked by a dependency, excluded from coverage), `blocked` (defect), `disqualified` (hidden) |
| `detect` | `event`, `span`, or `none` — `none` means it cannot emit telemetry and counts as working until verified by hand |
| `demo` | `true` marks a `detect: none` control as validated by live demonstration. It still renders as the grey check and still counts as working; the flag adds a *demo-able* badge and says so in the tooltips |
| `confidence` | `inferred` marks the rule as never confirmed against real data, and underlines it in the header |
| `priority` | Tie-break when several rules match one row; highest wins |
| `exclusive` | Prefer this rule over non-exclusive matches before comparing priority |
| `unit` | Noun for counts ("detections", "attestations") |
| `unitKey` | Dotted path to count distinct values instead of rows |
| `risk` | Each firing is an attempted violation; raises a finding |
| `note`, `issue`, `hold`, `watch` | Prose surfaced in tooltips and findings |
| `signals` | Detection rules, below |

### Detection rules

A signal is `{ "source": "event" | "span", "match": <predicate> }`. Predicates are
interpreted, never `eval`'d, so they are safe to edit and paste around.

Combine with `all`, `any`, `not`. Leaves name a `field` (dotted path — `data.category`
reaches into the parsed JSON payload) and one operator:

| Operator | Matches when |
|---|---|
| `eq` / `ne` | equal / not equal |
| `in` | value is in the given array |
| `anyOf` | value (or any element, if it is an array) appears in the given array |
| `contains` / `startsWith` | substring tests |
| `matches` | regular expression |
| `domainIn` | the URL's registrable domain equals or is a subdomain of one listed |
| `exists` | `true` → present and non-empty; `false` → absent or empty |

Add `"ci": true` to any leaf for case-insensitive comparison.

Available fields — **event**: `event_type`, `url`, `domain`, `policy`, `data.*`.
**span**: `kind`, `name`, `domain`, `hostname`, `focused`, `idle`, `active`, `level`,
`cls`, `policy`.

```jsonc
// everything in the pattern stream that is NOT a card
{ "source": "event", "match": { "all": [
  { "field": "event_type",     "eq": "security" },
  { "field": "data.category",  "eq": "text_pattern_match" },
  { "not": { "field": "data.categories", "anyOf": ["credit card"], "ci": true } }
]}}
```

`config.example.json` is a complete worked example exercising every operator above.

## Notes

- Card-shaped digit runs are masked in justifications and messages before display.
- Events identical to the second, for the same person and control, are flagged as
  duplicates and collapsed by default — inconsistent `allFrames` across triggers makes
  a control fire once per frame, so raw counts overstate what happened.
- Shrinking a roster removes that person's stored rows on the next load.
- Clearing data affects only your own browser.
