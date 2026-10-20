/** A syllable nucleus: a diphthong, a long vowel spelled double, or one vowel. */
const NUCLEUS = /ei|ai|au|eu|äu|ie|aa|ee|oo|[aeiouyäöü]/giu;

/** Syllable nuclei as a syllable count: `Tag` 1, `Bein` 1, `teuer` 2, `Formular` 3. */
export function syllableCount(word: string): number {
	return word.match(NUCLEUS)?.length ?? 0;
}

export function lower(word: string): string {
	return word.toLocaleLowerCase("de");
}

export function endsWithVowel(word: string): boolean {
	return /[aeiouyäöü]$/iu.test(word);
}

/** Ends in a sibilant that fuses with an `s` ending: s, ß, x, z, tz. */
export function endsWithSibilant(word: string): boolean {
	return /[sßxz]$/iu.test(word);
}

export function hasVowel(word: string): boolean {
	return syllableCount(word) > 0;
}
