export const taskDescription = `You receive:
- context: sentence where the target was found
- target: { lemma, linguisticUnit: "Phrasem", posLikeKind, surfaceKind }

Return:
- linguisticUnit: "Phrasem"
- posLikeKind: exactly the same phraseme kind as in input target
- ipa: IPA pronunciation for the lemma
- emojiDescription: 1-3 emojis for the current sense
- senseGloss: short sense label (2-8 words) that distinguishes this sense from homonyms

Rules:
- Preserve target classification: do not change linguisticUnit or posLikeKind.
- senseGloss must be context-independent (e.g., "certainly / definitely"), not a full sentence.`;
