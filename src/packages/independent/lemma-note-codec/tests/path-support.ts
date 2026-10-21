import { ParsingError, parseAsLemmaRecord, parseAsReadingEntry } from "dumdict";
import type * as Dumling from "dumling/types";

export type DeLemma = Dumling.Lemma<"de">;

/** A German Lemma as dumdict accepts it, or a thrown fixture error. */
export function lemma(
	family: string,
	kind: string,
	canonicalForm: string,
	coreFeatures: Record<string, unknown> = {},
): DeLemma {
	const parsed = parseAsLemmaRecord(
		{
			lemma: {
				canonicalForm,
				coreFeatures,
				family,
				kind,
				language: "de",
				unitKind: "Lemma",
			},
		},
		"de",
	);
	if (parsed instanceof ParsingError)
		throw new Error(`Invalid fixture ${canonicalForm}: ${parsed.message}`);
	return parsed.lemma;
}

/**
 * A Reading as written, not normalized by dumling's schema, so a test can
 * hand the path module variation selectors and skin tones. A Foreign
 * Reading has no Emoji Description.
 */
export function reading(
	of: DeLemma,
	emojiDescription?: string,
): Dumling.Reading<"de"> {
	return (
		emojiDescription === undefined
			? { lemma: of, unitKind: "Reading" }
			: { emojiDescription, lemma: of, unitKind: "Reading" }
	) as Dumling.Reading<"de">;
}

/** Whether dumdict accepts a Reading Entry with this Emoji Description. */
export function acceptsEmojiDescription(
	of: DeLemma,
	emojiDescription: string,
): boolean {
	const parsed = parseAsReadingEntry(
		{
			attestationLinks: [],
			attestedTranslations: [],
			notes: "",
			reading: { emojiDescription, lemma: of, unitKind: "Reading" },
		},
		"de",
	);
	return !(parsed instanceof ParsingError);
}

/** A deterministic generator (mulberry32), so property tests replay. */
export function seeded(seed: number): () => number {
	let state = seed >>> 0;
	return () => {
		state = (state + 0x6d2b79f5) >>> 0;
		let t = state;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

export function pick<T>(random: () => number, items: readonly T[]): T {
	const item = items[Math.floor(random() * items.length)];
	if (item === undefined) throw new Error("Nothing to pick from");
	return item;
}

/** A string of up to `maxLength` pieces drawn from `alphabet`. */
export function randomText(
	random: () => number,
	alphabet: readonly string[],
	maxLength: number,
): string {
	const length = Math.floor(random() * (maxLength + 1));
	return Array.from({ length }, () => pick(random, alphabet)).join("");
}
