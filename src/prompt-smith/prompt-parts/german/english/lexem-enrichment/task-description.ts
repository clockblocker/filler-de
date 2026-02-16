export const taskDescription = `You receive:
- context: sentence where the target was found
- target: { lemma, linguisticUnit: "Lexem", posLikeKind, surfaceKind }

Return:
- linguisticUnit: "Lexem"
- posLikeKind: exactly the same POS as in input target
- ipa: IPA pronunciation for the lemma
- emojiDescription: 1-3 emojis for the current sense
- senseGloss: short sense label (2-8 words) that distinguishes this sense from homonyms
- genus and nounClass ONLY when posLikeKind is "Noun"

Rules:
- Preserve target classification: do not change linguisticUnit or posLikeKind.
- senseGloss must be context-independent (e.g., "door lock", "river bench"), not a full sentence.
- For Noun, genus + nounClass are required.
- For non-nouns, genus and nounClass must be omitted.`;
