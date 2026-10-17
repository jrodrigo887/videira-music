# Fundação do design system — Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and follow its Execute flow and Critical Rules.** Do not search for skill files by filesystem path. The skill is the source of truth for the full flow (per-task cycle, sub-agent delegation, adequacy review, Verifier, discrimination sensor).

**If the skill cannot be activated, STOP and tell the user - do not proceed without it.**

---

**Design**: `.specs/features/design-foundation/design.md`
**Status**: Draft

---

## Test Coverage Matrix

> Generated from codebase, project guidelines, and spec - confirm before Execute. Guidelines found: none for coverage depth. Commands come from `package.json` (`test`: `vitest run`, `lint`: `eslint app components lib types --ext .ts,.tsx`) and `vitest.config.ts` (include `**/*.test.{ts,tsx}`, no coverage threshold). Sampled tests: `app/layout.test.tsx`, `components/setlists/setlist-editor.test.tsx`, `app/songs/[songId]/song-detail.test.tsx`, `lib/charts/chart-history-service.test.ts`. Strong defaults applied for `brandStyle` and the file contract.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| --- | --- | --- | --- | --- |
| Brand rules | unit | All branches; 1:1 with DS-01..DS-06 and the listed edge cases | `lib/design/brand.test.ts` | `npm test -- lib/design/brand.test.ts` |
| Theme file contract | unit | DS-08..DS-15, DS-18, DS-28..DS-30, DS-33, DS-14 as literal declarations and repo searches | `lib/design/theme-contract.test.ts` | `npm test -- lib/design/theme-contract.test.ts` |
| Layout | integration | DS-07 on the rendered `html` | `app/layout.test.tsx` | `npm test -- app/layout.test.tsx` |
| UI primitives | integration | DS-16, DS-17, DS-19, DS-22..DS-25, DS-31, DS-34..DS-36 | `components/ui/*.test.tsx` | `npm test -- components/ui` |
| Call sites | integration | DS-15, DS-20, DS-21, DS-26, DS-27, DS-32, DS-37 | colocated `*.test.tsx` next to the component | `npm test -- <target>` |

## Gate Check Commands

> Generated from codebase - confirm before Execute.

| Gate Level | When to Use | Command |
| --- | --- | --- |
| Quick | After a unit task | `npm test -- <target>` |
| Full | After a layout, primitive, or call-site task | `npm test` |
| Build | After the last task of a phase | `npm test && npm run lint` |

---

## Execution Plan

Phases are ordered and run sequentially. Tasks inside a phase run in order.

### Phase 1: Brand object

```text
T1 -> T2
```

### Phase 2: Tokens

```text
T3 -> T4
T3 -> T5
```

### Phase 3: Primitives

```text
T6
T7
T8
```

### Phase 4: Call sites

```text
T9
T10
T11
T12
T13
T14
```

### Phase 5: Contract lock

```text
T15 -> T16
```

---

## Task Breakdown

### Phase 1: Brand object

### T1: Validate and emit brand variables

**What**: Create `videiraBrand` and `brandStyle`, rejecting a missing key and a non-channel color.
**Where**: `lib/design/brand.ts`
**Depends on**: None
**Reuses**: The light HSL channels in `app/globals.css`
**Requirement**: DS-01, DS-02, DS-03, DS-04, DS-05, DS-06

**Tools**:

- MCP: NONE
- Skill: `tlc-spec-driven`

**Done when**:

- [ ] `brandStyle(videiraBrand)` returns only the five `--brand-*` values from DS-01
- [ ] `videiraBrand.name` is `Videira` and is absent from the style object
- [ ] An empty object throws `Brand color primary is required.`
- [ ] `primary: "#2d6b3e"` and `primary: "hsl(136, 42%, 33%)"` throw the HSL-channels message from DS-04
- [ ] A valid `primary` with `primaryHover` missing throws `Brand color primaryHover is required.`
- [ ] An extra key does not change the input object and does not appear in the result
- [ ] Gate check passes: `npm test -- lib/design/brand.test.ts`
- [ ] Test count: at least 8 tests pass

**Tests**: unit
**Gate**: quick

**Commit**: `feat(design-foundation): add the Videira brand style contract`

---

### T2: Apply the brand on the document

**What**: Pass `brandStyle(videiraBrand)` to the root `<html>` without changing the forced light theme.
**Where**: `app/layout.tsx`
**Depends on**: T1
**Reuses**: `lib/design/brand.ts` and the existing `className="light"`
**Requirement**: DS-07

**Tools**:

- MCP: NONE
- Skill: `tlc-spec-driven`

**Done when**:

- [ ] The rendered `html` has the five `--brand-*` values, a class containing `light`, and `data-theme="light"`
- [ ] The header text stays `Videira Music`
- [ ] Gate check passes: `npm test -- app/layout.test.tsx`
- [ ] Test count: the existing layout tests plus at least 1 new test pass

**Tests**: integration
**Gate**: full

**Commit**: `feat(design-foundation): inject brand variables on the document`

---

### Phase 2: Tokens

### T3: Point light semantics at the brand and add status

**What**: Map the light primary and chord tokens to `--brand-*`, keep the dark literals, and add status channels in both themes.
**Where**: `app/globals.css`
**Depends on**: T1
**Reuses**: The existing light and dark blocks
**Requirement**: DS-08, DS-09, DS-11, DS-12

**Tools**:

- MCP: NONE
- Skill: `tlc-spec-driven`

**Done when**:

- [ ] The light block sets `--color-primary`, `--color-primary-hover`, `--color-primary-foreground`, `--color-primary-subtle`, and `--color-chord` to the matching `var(--brand-*)`
- [ ] The dark block keeps the four literals from DS-09 and does not point them at `var(--brand-*)`
- [ ] Light status channels match DS-11 and dark status channels match DS-12
- [ ] `--color-focus` stays `var(--videira-500)`
- [ ] Gate check passes: `npm test -- lib/design/theme-contract.test.ts`
- [ ] Test count: at least 4 tests pass

**Tests**: unit
**Gate**: quick

**Commit**: `feat(design-foundation): map brand and status color tokens`

---

### T4: Expose status colors in Tailwind

**What**: Add `danger`, `warning`, and `success` with `DEFAULT`, `hover`, `foreground`, and `subtle`.
**Where**: `tailwind.config.ts`
**Depends on**: T3
**Reuses**: The `primary` color shape in the same file
**Requirement**: DS-13

**Tools**:

- MCP: NONE
- Skill: `tlc-spec-driven`

**Done when**:

- [ ] Each status color uses `hsl(var(--color-…) / <alpha-value>)` for `DEFAULT`, `hover`, `foreground`, and `subtle`
- [ ] Gate check passes: `npm test -- lib/design/theme-contract.test.ts`
- [ ] Test count: the T3 tests plus at least 1 new test pass

**Tests**: unit
**Gate**: quick

**Commit**: `feat(design-foundation): expose status colors to Tailwind`

---

### T5: Retarget the accent badge and add the danger button class

**What**: Make `.ds-badge-accent` use primary tokens and add `.ds-button-danger`.
**Where**: `app/globals.css`
**Depends on**: T3
**Reuses**: `.ds-badge` and `.ds-button`
**Requirement**: DS-10, DS-18

**Tools**:

- MCP: NONE
- Skill: `tlc-spec-driven`

**Done when**:

- [ ] `.ds-badge-accent` uses `bg-primary-subtle` and `text-primary`
- [ ] `.ds-button-danger` copies the radius, padding, text size, and focus ring of `.ds-button`, with `bg-danger`, `text-danger-foreground`, and `hover:bg-danger-hover`
- [ ] Gate check passes: `npm test -- lib/design/theme-contract.test.ts`
- [ ] Test count: the T4 tests plus at least 2 new tests pass

**Tests**: unit
**Gate**: quick

**Commit**: `feat(design-foundation): add danger button and primary accent badge`

---

### Phase 3: Primitives

### T6: Add the button primitive

**What**: Render one variant class and forward native button props.
**Where**: `components/ui/button.tsx`
**Depends on**: T5
**Reuses**: `.ds-button`, `.ds-button-secondary`, `.ds-button-danger`
**Requirement**: DS-16, DS-17, DS-31

**Tools**:

- MCP: NONE
- Skill: `tlc-spec-driven`

**Done when**:

- [ ] `primary` renders `ds-button`, `secondary` renders `ds-button-secondary`, and `danger` renders `ds-button-danger`, one of those classes only
- [ ] Omitted `type` renders `type="button"`
- [ ] `type="submit"`, `disabled`, and `className="w-full"` all reach the element, and the variant class stays
- [ ] Gate check passes: `npm test -- components/ui/button.test.tsx`
- [ ] Test count: at least 4 tests pass

**Tests**: integration
**Gate**: full

**Commit**: `feat(design-foundation): add the button primitive`

---

### T7: Add the alert primitive

**What**: Render error text in a `role="alert"` paragraph with `text-danger`.
**Where**: `components/ui/alert.tsx`
**Depends on**: T4
**Reuses**: The current `text-sm text-red-600` paragraphs
**Requirement**: DS-19

**Tools**:

- MCP: NONE
- Skill: `tlc-spec-driven`

**Done when**:

- [ ] The text is inside an element with `role="alert"` and class `text-danger`
- [ ] Gate check passes: `npm test -- components/ui/alert.test.tsx`
- [ ] Test count: at least 1 test passes

**Tests**: integration
**Gate**: full

**Commit**: `feat(design-foundation): add the alert primitive`

---

### T8: Add the dialog shell

**What**: Render the modal shell with title wiring, Escape, overlay policy, scroll lock, and focus return.
**Where**: `components/ui/dialog.tsx`
**Depends on**: None
**Reuses**: The overlay and `.ds-card` in `components/setlists/followers-confirm-dialog.tsx`
**Requirement**: DS-22, DS-23, DS-24, DS-25, DS-34, DS-35, DS-36

**Tools**:

- MCP: NONE
- Skill: `tlc-spec-driven`

**Done when**:

- [ ] While open, the panel has `role="dialog"`, `aria-modal="true"`, and `aria-labelledby` pointing at the title id
- [ ] Opening moves focus to the panel and sets `document.body.style.overflow` to `hidden`
- [ ] Escape calls `onClose` once
- [ ] An overlay click calls `onClose` only when `closeOnOverlay` is true
- [ ] Closing restores the previous overflow and returns focus to the prior element
- [ ] Closing with no prior element does not throw
- [ ] The effect depends on `open`; `onClose` is read from a ref
- [ ] Gate check passes: `npm test -- components/ui/dialog.test.tsx`
- [ ] Test count: at least 6 tests pass

**Tests**: integration
**Gate**: full

**Commit**: `feat(design-foundation): add the dialog shell`

---

### Phase 4: Call sites

### T9: Show trash errors with Alert

**What**: Replace the red error paragraph in the trash list.
**Where**: `components/songs/song-trash-list.tsx`
**Depends on**: T7
**Reuses**: `components/ui/alert.tsx`
**Requirement**: DS-20, DS-32

**Tools**:

- MCP: NONE
- Skill: `tlc-spec-driven`

**Done when**:

- [ ] A non-empty restore error renders `Alert` with that text
- [ ] An empty message does not render `Alert`
- [ ] Gate check passes: `npm test -- components/songs/song-trash-list.test.tsx`
- [ ] Test count: at least 2 tests pass

**Tests**: integration
**Gate**: full

**Commit**: `feat(design-foundation): use Alert for trash errors`

---

### T10: Show setlist action errors with Alert

**What**: Replace the red error paragraph in setlist actions.
**Where**: `components/setlists/setlist-actions.tsx`
**Depends on**: T7
**Reuses**: `components/ui/alert.tsx`
**Requirement**: DS-20, DS-32

**Tools**:

- MCP: NONE
- Skill: `tlc-spec-driven`

**Done when**:

- [ ] A non-empty action error renders `Alert` with that text
- [ ] An empty message does not render `Alert`
- [ ] Gate check passes: `npm test -- components/setlists/setlist-actions.test.tsx`
- [ ] Test count: at least 2 tests pass

**Tests**: integration
**Gate**: full

**Commit**: `feat(design-foundation): use Alert for setlist action errors`

---

### T11: Show setlist form errors with Alert

**What**: Replace the red error paragraph in the setlist form.
**Where**: `components/setlists/setlist-form.tsx`
**Depends on**: T7
**Reuses**: `components/ui/alert.tsx`
**Requirement**: DS-20, DS-32

**Tools**:

- MCP: NONE
- Skill: `tlc-spec-driven`

**Done when**:

- [ ] A non-empty form error renders `Alert` with that text
- [ ] An empty error does not render `Alert`
- [ ] Gate check passes: `npm test -- components/setlists/setlist-form.test.tsx`
- [ ] Test count: at least 2 tests pass

**Tests**: integration
**Gate**: full

**Commit**: `feat(design-foundation): use Alert for setlist form errors`

---

### T12: Use Button and Alert on the group invite

**What**: Render "Enviar convite" as a primary submit `Button` and the error as `Alert`.
**Where**: `components/groups/team-invite-form.tsx`
**Depends on**: T6, T7
**Reuses**: `components/ui/button.tsx` and `components/ui/alert.tsx`
**Requirement**: DS-20, DS-21, DS-32

**Tools**:

- MCP: NONE
- Skill: `tlc-spec-driven`

**Done when**:

- [ ] "Enviar convite" is a `Button` with `variant="primary"` and `type="submit"`
- [ ] The file no longer contains `ds-button-primary`
- [ ] A non-empty invite error renders `Alert`; an empty message does not
- [ ] The `text-accent` invite link stays
- [ ] Gate check passes: `npm test -- components/groups/team-invite-form.test.tsx`
- [ ] Test count: at least 3 tests pass

**Tests**: integration
**Gate**: full

**Commit**: `feat(design-foundation): use Button and Alert on group invite`

---

### T13: Use danger and Alert in the setlist editor

**What**: Recolor the destructive hover and replace the note error paragraph.
**Where**: `components/setlists/setlist-editor.tsx`
**Depends on**: T4, T7
**Reuses**: `components/ui/alert.tsx` and the existing icon button class
**Requirement**: DS-15, DS-20, DS-32

**Tools**:

- MCP: NONE
- Skill: `tlc-spec-driven`

**Done when**:

- [ ] The destructive hover uses `hover:border-danger` and `hover:text-danger`
- [ ] A non-empty note error renders `Alert`; an empty note error does not
- [ ] The note dialog shell stays in this file
- [ ] Gate check passes: `npm test -- components/setlists/setlist-editor.test.tsx`
- [ ] Test count: the existing editor tests plus at least 2 new tests pass

**Tests**: integration
**Gate**: full

**Commit**: `feat(design-foundation): use danger tokens in the setlist editor`

---

### T14: Mount the followers dialog on the shell

**What**: Keep the followers copy and route busy state through `Dialog` and `Button`.
**Where**: `components/setlists/followers-confirm-dialog.tsx`
**Depends on**: T6, T8
**Reuses**: `components/ui/dialog.tsx` and `components/ui/button.tsx`
**Requirement**: DS-26, DS-27, DS-37

**Tools**:

- MCP: NONE
- Skill: `tlc-spec-driven`

**Done when**:

- [ ] One follower shows "Confirmar impacto", "1 grupo segue este setlist", "Deseja continuar?", "Cancelar", and "Confirmar"
- [ ] Two followers show "2 grupos seguem este setlist"
- [ ] While `busy`, both buttons are disabled and `closeOnOverlay` is false
- [ ] Gate check passes: `npm test -- components/setlists/followers-confirm-dialog.test.tsx`
- [ ] Test count: at least 3 tests pass

**Tests**: integration
**Gate**: full

**Commit**: `feat(design-foundation): mount the followers dialog on the shell`

---

### Phase 5: Contract lock

### T15: Forbid raw red and the missing button class

**What**: Assert that production TSX no longer uses the Tailwind red palette or `ds-button-primary`.
**Where**: `lib/design/theme-contract.test.ts`
**Depends on**: T9, T10, T11, T12, T13, T14
**Reuses**: The contract file started in T3
**Requirement**: DS-14, DS-33

**Tools**:

- MCP: NONE
- Skill: `tlc-spec-driven`

**Done when**:

- [ ] A search of `app/**/*.tsx` and `components/**/*.tsx` fails the test if it finds `text-red-`, `border-red-`, `bg-red-`, or `ds-button-primary`
- [ ] Gate check passes: `npm test -- lib/design/theme-contract.test.ts`
- [ ] Test count: the T5 tests plus at least 2 new tests pass

**Tests**: unit
**Gate**: quick

**Commit**: `test(design-foundation): lock the red and button class contract`

---

### T16: Write the brand contract into the design system doc

**What**: Record what a brand may change and delete the sentence that says status tokens are missing.
**Where**: `docs/design-system.md`
**Depends on**: T15
**Reuses**: Section 3 of the current doc
**Requirement**: DS-28, DS-29, DS-30

**Tools**:

- MCP: NONE
- Skill: `tlc-spec-driven`

**Done when**:

- [ ] The doc names `videiraBrand` and the keys `primary`, `primaryHover`, `primaryForeground`, `primarySubtle`, and `chord` as what a brand changes
- [ ] The doc states that neutrals, status, mesa/estante density, chart structure, radius, and type families do not change with the brand
- [ ] The sentence `Status ainda não está em globals.css` is gone
- [ ] Gate check passes: `npm test -- lib/design/theme-contract.test.ts && npm test && npm run lint`
- [ ] Test count: the T15 tests plus at least 3 new tests pass

**Tests**: unit
**Gate**: build

**Commit**: `docs(design-foundation): record the brand contract`

---

## Phase Execution Map

```text
Phase 1 -> Phase 2 -> Phase 3 -> Phase 4 -> Phase 5

Phase 1:  T1 -> T2
Phase 2:  T3 -> T4
          T3 -> T5
Phase 3:  T6
          T7
          T8
Phase 4:  T9
          T10
          T11
          T12
          T13
          T14
Phase 5:  T15 -> T16
```

Execution is strictly sequential. Sixteen tasks pack into three batches of whole phases: Phase 1–2 (5), Phase 3–4 (9), Phase 5 (2). Offer batch sub-agents before Execute. Do not split a phase across workers.

---

## Task Granularity Check

| Task | Scope | Status |
| --- | --- | --- |
| T1: brandStyle | 1 function | ✅ Granular |
| T2: layout style | 1 file | ✅ Granular |
| T3: CSS tokens | 1 file | ✅ Granular |
| T4: Tailwind status | 1 file | ✅ Granular |
| T5: badge and danger class | 1 file | ✅ Granular |
| T6: Button | 1 component | ✅ Granular |
| T7: Alert | 1 component | ✅ Granular |
| T8: Dialog | 1 component | ✅ Granular |
| T9: trash alert | 1 file | ✅ Granular |
| T10: setlist actions alert | 1 file | ✅ Granular |
| T11: setlist form alert | 1 file | ✅ Granular |
| T12: invite button and alert | 1 file | ✅ Granular |
| T13: editor danger and alert | 1 file | ✅ Granular |
| T14: followers dialog | 1 file | ✅ Granular |
| T15: red and class search | 1 test file | ✅ Granular |
| T16: design system doc | 1 file | ✅ Granular |

---

## Diagram-Definition Cross-Check

| Task | Depends On (task body) | Diagram Shows | Status |
| --- | --- | --- | --- |
| T1 | None | no incoming arrow | ✅ Match |
| T2 | T1 | T1 -> T2 | ✅ Match |
| T3 | T1 | T1 is the previous phase, no intra-phase arrow | ✅ Match |
| T4 | T3 | T3 -> T4 | ✅ Match |
| T5 | T3 | T3 -> T5 | ✅ Match |
| T6 | T5 | T5 is the previous phase, no intra-phase arrow | ✅ Match |
| T7 | T4 | T4 is the previous phase, no intra-phase arrow | ✅ Match |
| T8 | None | no incoming arrow | ✅ Match |
| T9 | T7 | T7 is the previous phase, no intra-phase arrow | ✅ Match |
| T10 | T7 | T7 is the previous phase, no intra-phase arrow | ✅ Match |
| T11 | T7 | T7 is the previous phase, no intra-phase arrow | ✅ Match |
| T12 | T6, T7 | both are the previous phase, no intra-phase arrow | ✅ Match |
| T13 | T4, T7 | both are previous phases, no intra-phase arrow | ✅ Match |
| T14 | T6, T8 | both are the previous phase, no intra-phase arrow | ✅ Match |
| T15 | T9, T10, T11, T12, T13, T14 | all are the previous phase, no intra-phase arrow | ✅ Match |
| T16 | T15 | T15 -> T16 | ✅ Match |

---

## Test Co-location Validation

| Task | Code Layer Created/Modified | Matrix Requires | Task Says | Status |
| --- | --- | --- | --- | --- |
| T1: brandStyle | Brand rules | unit | unit | ✅ OK |
| T2: layout style | Layout | integration | integration | ✅ OK |
| T3: CSS tokens | Theme file contract | unit | unit | ✅ OK |
| T4: Tailwind status | Theme file contract | unit | unit | ✅ OK |
| T5: badge and danger class | Theme file contract | unit | unit | ✅ OK |
| T6: Button | UI primitives | integration | integration | ✅ OK |
| T7: Alert | UI primitives | integration | integration | ✅ OK |
| T8: Dialog | UI primitives | integration | integration | ✅ OK |
| T9: trash alert | Call sites | integration | integration | ✅ OK |
| T10: setlist actions alert | Call sites | integration | integration | ✅ OK |
| T11: setlist form alert | Call sites | integration | integration | ✅ OK |
| T12: invite button and alert | Call sites | integration | integration | ✅ OK |
| T13: editor danger and alert | Call sites | integration | integration | ✅ OK |
| T14: followers dialog | Call sites | integration | integration | ✅ OK |
| T15: red and class search | Theme file contract | unit | unit | ✅ OK |
| T16: design system doc | Theme file contract | unit | unit | ✅ OK |
