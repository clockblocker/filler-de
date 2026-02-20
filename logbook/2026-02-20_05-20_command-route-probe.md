# Command Route Probe

- Date: 2026-02-20
- Time: ~05:20 (+0100)
- Vault: `cli-e2e-test-vault`
- Source: `textfresser/0_Synthetic_Test_To_Check_Morhp.md`

## Test

Used Obsidian CLI `eval` to:
1. Open source note in editor.
2. Select `fährt` in editor.
3. Execute `app.commands.executeCommandById('cbcr-text-eater-de:lemma')`.
4. Wait for `whenIdle()`.
5. Read source note back.

## Result

- Command route returned `command-fired`.
- Idle wait returned `idle`.
- Source remained unchanged (no wikilink insertion).

## Conclusion

No-marking issue reproduces through both paths:
- direct helper path (`textfresser-runbook lemma` -> `lemma-fire.ts`)
- direct Obsidian command route (`executeCommandById`)

