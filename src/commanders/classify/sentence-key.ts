/**
 * The Segmentation Cache key of a Sentence (ADR 0014):
 * `sha256(segmenterVersion, language, stitchedText(nfc(text)))`. It names
 * no Scroll, path or position, so only an edit to the Sentence itself, or a
 * new segmenter, changes it.
 */
import { sha256Hex } from "@textfresser/lemma-note-codec";
import { stitchedText } from "dumgen";
import { segmenterSourceHash } from "./segmenter-source-hash" with {
	type: "macro",
};

/**
 * The dumgen version, the jev model `segment.inUnits` pins, and a hash of
 * the battery sources segmentation runs on, taken when the plugin is
 * bundled. A test checks the first two against the linked batteries; the
 * hash makes any change to those sources, version bump or not, miss the
 * old cache entries.
 */
export const DUMGEN_SEGMENTER_VERSION = `dumgen@0.1.0+jev-1.13.0+src-${segmenterSourceHash()}`;

/** A Sentence's Stitched Text, the text its Segments give back. */
export function sentenceStitchedText(text: string): string {
	return stitchedText(text.normalize("NFC"));
}

export function sentenceKey(
	segmenterVersion: string,
	language: string,
	text: string,
): string {
	return sha256Hex(
		JSON.stringify([
			segmenterVersion,
			language,
			sentenceStitchedText(text),
		]),
	);
}

/**
 * Per Sentence, how many earlier Sentences of the Scroll have its Stitched
 * Text: 0 for the first instance of a text, 1 for its first repeat, and so
 * on. It tells the instances of a repeated Sentence apart, so each keeps its
 * own occurrences.
 */
export function sentenceInstances(texts: readonly string[]): number[] {
	const seen = new Map<string, number>();
	return texts.map((text) => {
		const stitched = sentenceStitchedText(text);
		const instance = seen.get(stitched) ?? 0;
		seen.set(stitched, instance + 1);
		return instance;
	});
}
