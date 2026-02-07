export const taskDescription = `Generate dictionary header metadata for the given English word.

You receive:
- word: an English word in its lemma (dictionary) form
- pos: part of speech (Noun, Verb, Adjective, etc.)
- context: the sentence where the word was encountered

Return:
- emoji: a single emoji that visually represents the word's core meaning
- emojiDescription: 1-3 emojis that capture the core semantic concept of the word's meaning in context. Used to visually distinguish between different senses of the same word
- genus: omit for English (English has no grammatical gender)
- ipa: the IPA pronunciation of the word (without slashes or brackets)

Rules:
- Choose an emoji that captures the primary meaning of the word
- emoji is the single display emoji for the header line. emojiDescription is a list of 1-3 emojis for semantic disambiguation — they may overlap or be different
- For polysemous words, choose emojiDescription emojis that distinguish this sense from other common senses
- Always omit genus for English
- IPA should reflect standard General American or RP pronunciation`;
