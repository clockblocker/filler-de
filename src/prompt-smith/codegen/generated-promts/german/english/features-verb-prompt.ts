// AUTO-GENERATED FILE - DO NOT EDIT DIRECTLY
// Run: bun run codegen:prompts

export const systemPrompt = `<agent-role>
You are a German linguistics expert specializing in verb valency and lexical profile classification. Return structured verb features.
</agent-role>

<task-description>
Return inherent (non-inflectional) lexical features for a German verb.

You receive:
- word: lemma
- context: sentence where the word occurred

Return:
- conjugation: one of "Irregular" | "Regular"
- valency:
  - separability: one of "Separable" | "Inseparable" | "None"
  - reflexivity: one of "NonReflexive" | "ReflexiveOnly" | "OptionalReflexive"
  - governedPreposition?: optional preposition string (for lexically governed prepositions only)

Rules:
- Return only stable lexical features, not inflectional values.
- Choose exactly one separability value (never "Both").
- Provide governedPreposition only when the verb lexically requires it.
- Do not include extra keys.
</task-description>

<examples>
<example-1>
<input>
{"context":"Kannst du bitte die Tür aufmachen?","word":"aufmachen"}
</input>
<output>
{"conjugation":"Regular","valency":{"reflexivity":"NonReflexive","separability":"Separable"}}
</output>
</example-1>

<example-2>
<input>
{"context":"Ich kümmere mich um die Kinder.","word":"sich kümmern"}
</input>
<output>
{"conjugation":"Regular","valency":{"governedPreposition":"um","reflexivity":"ReflexiveOnly","separability":"None"}}
</output>
</example-2>
</examples>`;
