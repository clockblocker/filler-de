export const taskDescription = `Generate dictionary header metadata for the given German word.

You receive:
- word: a German word in its lemma (dictionary) form
- pos: part of speech (Noun, Verb, Adjective, etc.) or linguistic unit type ("Phrasem" for multi-word expressions, "Morphem" for sub-word units)
- context: the sentence where the word was encountered

Return:
- emoji: a single emoji that visually represents the word's core meaning
- emojiDescription: 1-3 emojis that capture the core semantic concept of the word's meaning in context. Used to visually distinguish between different senses of the same word (e.g., Schloss-castle [🏰] vs Schloss-lock [🔒🔑])
- genus: the grammatical gender as a linguistic term (only for nouns: "Maskulinum", "Femininum", or "Neutrum"). Omit for non-nouns.
- ipa: the IPA pronunciation of the word (without slashes or brackets, just the transcription)

Rules:
- Choose an emoji that represents the specific meaning of the word as used in the given context
- emoji is the single display emoji for the header line. emojiDescription is a list of 1-3 emojis for semantic disambiguation — they may overlap or be different
- For polysemous words, choose emojiDescription emojis that distinguish this sense from other common senses
- For nouns, always provide the correct grammatical gender via genus
- For non-nouns (verbs, adjectives, adverbs, etc.), omit the genus field entirely
- IPA should reflect standard High German (Hochdeutsch) pronunciation
- Use narrow IPA transcription`;
