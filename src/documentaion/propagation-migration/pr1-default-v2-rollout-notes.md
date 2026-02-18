# PR1: Default `propagationV2Enabled=true` (keep kill-switch + v1 path)

Date prepared: February 18, 2026

## Scope

1. Set default `propagationV2Enabled` to `true`.
2. Keep rollback controls intact:
   - Global kill-switch (`propagationV2Enabled=false`) still routes all invocations to `v1`.
   - `v1` propagation chain is still present and callable.
3. No v1 deletion in PR1.

## Slice Gate Evidence (verb included)

Commands:

```bash
bun test tests/unit/textfresser/steps/propagate-v2-phase4.test.ts
bun test tests/unit/textfresser/steps/propagate-generated-sections.test.ts
```

Observed:

1. `propagate-v2-phase4.test.ts`: `15 pass`, `0 fail` (includes dedicated verb slice gates and wrapper-level source-note separability-decoration parity).
2. `propagate-generated-sections.test.ts`: `4 pass`, `0 fail` (routing guard with kill-switch behavior; migrated-slice routing includes verb).

## Full-Test Non-Regression

Command:

```bash
bun test
```

Result:

1. Baseline failures: `8`
2. PR1 failures: `8`
3. Non-regression statement: failure count did not increase.

## `typecheck:changed` Caveat + Alternative Proof

Command:

```bash
bash scripts/typecheck-changed.sh
```

Observed:

1. Exit code is `1` even when there are no changed-file errors, due script behavior (`grep` exits non-zero on no matches).

Alternative proof used in PR1:

```bash
bun x tsc --noEmit
```

Scoped check against PR1-touched files:

1. `src/types.ts`
2. `src/commanders/textfresser/textfresser.ts`
3. `src/commanders/textfresser/state/textfresser-state.ts`
4. `tests/unit/common-utils/consts.ts`

Observed: no TypeScript errors for scoped files (`SCOPED_TSC_NO_ERRORS`).

## Soak Tracker (PR2 Gate)

Required criteria (from architecture doc):

1. 14 consecutive days with PR1 deployed.
2. At least 100 successful `Generate` runs across at least 3 migrated slices.
3. Zero kill-switch rollback activations.
4. Zero open P0/P1 propagation regressions at cut time.
5. PR2 head green on parity/idempotency/fail-fast suites.

Tracking status:

1. Soak start date: February 18, 2026
2. Earliest eligible PR2 date (14 full days): March 4, 2026
3. Current status: in progress (requires runtime observation period)
