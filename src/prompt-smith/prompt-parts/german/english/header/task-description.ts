export const taskDescription = `Generate dictionary header metadata for the given German word.

You receive:
- word: a German word in its lemma (dictionary) form
- pos: part of speech (Noun, Verb, Adjective, etc.) or linguistic unit type ("Phrasem" for multi-word expressions, "Morphem" for sub-word units)
- context: the sentence where the word was encountered

Return:
- emoji: a single emoji that visually represents the word's core meaning
- article: the German definite article (only for nouns: "der", "die", or "das"). Omit for non-nouns.
- ipa: the IPA pronunciation of the word (without slashes or brackets, just the transcription)

Rules:
- Choose an emoji that represents the specific meaning of the word as used in the given context
- For nouns, always provide the correct grammatical gender via article
- For non-nouns (verbs, adjectives, adverbs, etc.), omit the article field entirely
- IPA should reflect standard High German (Hochdeutsch) pronunciation
- Use narrow IPA transcription`;
