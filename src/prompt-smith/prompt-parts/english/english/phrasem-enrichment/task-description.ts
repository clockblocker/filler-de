export const taskDescription = `You receive:
- context: sentence where the target was found
- target: { lemma, linguisticUnit: "Phrasem", posLikeKind, surfaceKind } for an English multi-word expression

Return:
- linguisticUnit: "Phrasem"
- posLikeKind: exactly the same phraseme kind as in input target
- ipa: IPA pronunciation for the lemma
- emojiDescription: 1-3 emojis for the current sense

Rules:
- Preserve target classification: do not change linguisticUnit or posLikeKind.`;
