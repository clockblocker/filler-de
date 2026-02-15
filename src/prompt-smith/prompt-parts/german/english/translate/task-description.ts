export const taskDescription = `Translate the text between German and English:
- German input → English output
- English input → German output
- Other language → English output

CRITICAL: Preserve markdown decorations (**, *, ==, ~~, \`, []) in output.
If a word/phrase is decorated, find the **same concept** in translation and decorate it.
Decorated concept > exact grammar. Minor restructuring allowed to keep decorated word intact.
For idioms: decorate the equivalent expression, not literal words.
Bend grammar to preserve decorated grammar quirks (e.g., reflexive → find oneself).
Separable verbs: preserve prefix via equivalent construction (e.g., zu|stimmen → go *along*).`;
