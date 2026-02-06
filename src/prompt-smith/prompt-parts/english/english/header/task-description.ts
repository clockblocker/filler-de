export const taskDescription = `Generate dictionary header metadata for the given English word.

You receive:
- word: an English word in its lemma (dictionary) form
- pos: part of speech (Noun, Verb, Adjective, etc.)
- context: the sentence where the word was encountered

Return:
- emoji: a single emoji that visually represents the word's core meaning
- article: omit for English (English has no grammatical gender articles)
- ipa: the IPA pronunciation of the word (without slashes or brackets)

Rules:
- Choose an emoji that captures the primary meaning of the word
- Always omit article for English
- IPA should reflect standard General American or RP pronunciation`;
