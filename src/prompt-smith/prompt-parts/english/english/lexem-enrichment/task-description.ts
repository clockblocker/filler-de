export const taskDescription = `You receive:
- context: sentence where the target was found
- target: { lemma, linguisticUnit: "Lexem", posLikeKind, surfaceKind } for an English lexical item

Return:
- linguisticUnit: "Lexem"
- posLikeKind: exactly the same POS as in input target
- ipa: IPA pronunciation for the lemma
- emojiDescription: 1-3 emojis for the current sense
- nounClass only when posLikeKind is "Noun" and it is clearly inferable (Common/Proper)
- genus is optional and usually omitted for English

Rules:
- Preserve target classification: do not change linguisticUnit or posLikeKind.
- For non-nouns, genus and nounClass must be omitted.`;
