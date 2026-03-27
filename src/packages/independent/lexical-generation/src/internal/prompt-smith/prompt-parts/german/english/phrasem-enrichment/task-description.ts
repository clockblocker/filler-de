export const taskDescription = `You receive:
- context: sentence where the target was found
- word: phrasem lemma
- kind: phraseme kind (Idiom, Collocation, DiscourseFormula, ...)

Return:
- ipa: IPA pronunciation for the lemma
- emojiDescription: 1-3 emojis for the current sense
- senseGloss: short sense label (2-8 words) that distinguishes this sense from homonyms

Rules:
- senseGloss must be context-independent (e.g., "certainly / definitely"), not a full sentence.`;
