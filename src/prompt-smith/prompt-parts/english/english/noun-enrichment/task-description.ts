export const taskDescription = `You receive:
- context: sentence where the noun was found
- word: noun lemma

Return:
- ipa: IPA pronunciation for the lemma
- emojiDescription: 1-3 emojis for the current sense
- senseGloss: optional short sense label (2-8 words)
- nounClass: optional noun class (Common | Proper)
- genus: optional genus (usually omitted for English)

Rules:
- Keep noun metadata best-effort: genus and nounClass may be omitted if uncertain.`;
