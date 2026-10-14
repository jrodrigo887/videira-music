# LESSONS - auto-maintained by scripts/lessons.py

> Machine-owned. Do NOT hand-edit. Changes are overwritten on the next `lessons.py` write.
> Canonical state lives in `.specs/lessons.json`. Edit lessons only via the script.
> promote_threshold=2 distinct features · window_days=45 · quarantine_threshold=2

## Confirmed (load these at Specify/Design)

Corroborated across multiple features. Safe to apply as guidance.

_none_

## Candidates (under observation - do NOT load as guidance yet)

Seen once or not yet corroborated. Tracked, not trusted.

### L-001 - Test the disabled-flag branch of every feature-gated UI control, not only the enabled branch
- signal: `surviving_mutant` · recurrence: 1 feature(s) · scope: `ui` · harmful: 0
- features: chart-import
- evidence: M1 components/import/import-workflow.tsx:200 (ui)
- last seen: 2026-10-09T21:14:59Z

### L-002 - Assert that non-matching candidates are excluded from filtered or suggested lists, not only that a matching one appears
- signal: `surviving_mutant` · recurrence: 1 feature(s) · scope: `ui` · harmful: 0
- features: chart-import
- evidence: M3 components/import/import-workflow.tsx:97 (ui)
- last seen: 2026-10-09T21:14:59Z

### L-003 - Exercise environment-flag expressions through the exported handler or page, not only through an injected predicate
- signal: `ac_gap` · recurrence: 1 feature(s) · scope: `routes` · harmful: 0
- features: chart-import
- evidence: AC Importar URL #2 (hide URL input when flag off) (routes)
- last seen: 2026-10-09T21:14:59Z

### L-004 - Give every spec concurrency or ordering edge case a test that runs the operations back to back and asserts all records survive
- signal: `ac_gap` · recurrence: 1 feature(s) · scope: `persistence` · harmful: 0
- features: chart-import
- evidence: Edge case: two saves in sequence serialized (spec.md Edge Cases) (persistence)
- last seen: 2026-10-09T21:14:59Z

### L-005 - Define the observable output when a spec says a UI edit updates a preview, and assert the edited value reaches the saved record
- signal: `spec_precision_gap` · recurrence: 1 feature(s) · scope: `ui` · harmful: 0
- features: chart-import
- evidence: AC Importar texto #4 (section type updates preview) (ui)
- last seen: 2026-10-09T21:14:59Z

### L-006 - Exercise environment-flag expressions through the exported handler or page, not only through an injected predicate
- signal: `surviving_mutant` · recurrence: 1 feature(s) · scope: `routes` · harmful: 0
- features: chart-import
- evidence: M3 app/api/imports/cifraclub/route.ts:90 (routes)
- last seen: 2026-10-09T21:22:17Z

## Quarantined (failed when applied - ignore)

A confirmed lesson that recurred alongside failure. Kept for the maintainer to review.

_none_
