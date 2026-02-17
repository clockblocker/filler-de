export const taskDescription = `You receive:
- context: sentence where the noun was found
- word: noun lemma

Return:
- ipa: IPA pronunciation for the lemma
- emojiDescription: 1-3 emojis for the current sense
- senseGloss: short sense label (2-8 words) that distinguishes this sense from homonyms
- genus: optional noun genus (Maskulinum | Femininum | Neutrum)
- nounClass: optional noun class (Common | Proper)

Rules:
- Keep noun metadata best-effort: genus and nounClass may be omitted if uncertain.
- senseGloss must be context-independent (e.g., "door lock", "river bank"), not a full sentence.`;
