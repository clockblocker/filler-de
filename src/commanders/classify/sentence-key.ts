/**
 * The Segmentation Cache key of a Sentence (ADR 0014):
 * `sha256(segmenterVersion, language, stitchedText(nfc(text)))`. It names
 * no Scroll, path or position, so only an edit to the Sentence itself, or a
 * new segmenter, changes it.
 */
import { sha256Hex } from "@textfresser/lemma-note-codec";
import { stitchedText } from "dumgen";

/**
 * The dumgen version and the jev model `segment.inUnits` pins. A test
 * checks both against the linked batteries, so a battery upgrade that
 * could segment differently misses the old cache entries.
 */
export const DUMGEN_SEGMENTER_VERSION = "dumgen@0.1.0+jev-1.13.0";

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
