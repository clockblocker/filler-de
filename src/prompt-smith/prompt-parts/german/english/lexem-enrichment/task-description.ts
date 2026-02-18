export const taskDescription = `You receive:
- context: sentence where the target was found
- word: lemma
- pos: lexem POS (Noun, Verb, Adjective, ...)

Return:
- ipa: IPA pronunciation for the lemma
- emojiDescription: 1-3 emojis for the current sense
- senseGloss: short sense label (2-8 words) that distinguishes this sense from homonyms

Rules:
- senseGloss must be context-independent (e.g., "door lock", "river bench"), not a full sentence.
- Do not output grammatical class metadata such as genus or nounClass.`;
