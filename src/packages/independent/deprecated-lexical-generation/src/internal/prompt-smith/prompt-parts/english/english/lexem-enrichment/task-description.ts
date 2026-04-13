export const taskDescription = `You receive:
- context: sentence where the target was found
- word: lemma
- pos: lexem POS (Noun, Verb, Adjective, ...) for an English lexical item

Return:
- ipa: IPA pronunciation for the lemma
- emojiDescription: 1-3 emojis for the current sense
- senseGloss: optional short sense label (2-8 words)

Rules:
- Do not output grammatical class metadata such as genus or nounClass.`;
