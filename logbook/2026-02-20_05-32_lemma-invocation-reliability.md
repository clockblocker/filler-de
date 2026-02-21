# Lemma Invocation Reliability Investigation

- Date: 2026-02-20
- Vault: `cli-e2e-test-vault`
- Source: `textfresser/0_Synthetic_Test_To_Check_Morhp.md`

## Problem

Observed inconsistent behavior where lemma calls looked successful but source marking did not happen, or happened later than expected.

## Root findings

1. Previous helper (`scripts/runbook/lemma-fire.ts`) did not await `textfresser.executeCommand(...)` result.
2. Obsidian CLI `eval` intermittently returns empty stdout even when side effects happen.
3. Relying on eval response alone is unreliable in this vault session.

## Reliable strategy

Use post-condition verification as source of truth:
1. Trigger lemma via direct `textfresser` path.
2. Poll source file content via CLI `read` (not eval output) until the selected surface is linked.
3. If not linked within timeout, trigger fallback command-id route (`cbcr-text-eater-de:lemma`) and poll again.
4. Report success only when source content actually contains wikilink for the surface.

## Implementation

Updated `scripts/runbook/lemma-fire.ts` to:
- support two invocation strategies (textfresser + command-id fallback),
- tolerate empty eval output,
- verify success by reading source content and polling for link insertion.

## Validation run

After cleaning wikilinks and running 9 lemma calls with 4s spacing:
- source got marked for all tested surfaces,
- `links-source` returned expected targets,
- `scan-empty` reported all linked entries non-empty.

