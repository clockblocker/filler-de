/**
 * Sharded path computation for dictionary entries.
 *
 * Generates deterministic folder structure based on word name:
 * Worter/<lang>/<unit>/<surface>/<first>/<prefix>/<shard>
 *
 * Example: "anfangen" (German, Lexem, Lemma) → ["Worter", "de", "lexem", "lemma", "a", "anf", "anfan"]
 */

import type {
	LinguisticUnitKind,
	SurfaceKind,
} from "../../../linguistics/common/enums/core";
import { LANGUAGE_ISO_CODE } from "../../../linguistics/common/enums/core";
import type { TargetLanguage } from "../../../types";

const WORTER_ROOT = "Worter";
const PREFIX_LENGTH = 3;
const SHARD_LENGTH = 5;

/** Index of the surface-kind segment in the path parts array (e.g. "lemma" or "inflected"). */
export const SURFACE_KIND_PATH_INDEX = 3;

/**
 * Computes the shard segments (first char, prefix, shard) for a word.
 *
 * @param name - The word/file basename (e.g., "anfangen")
 * @returns Shard segments: [first, prefix, shard]
 */
export function computeShardSegments(name: string): string[] {
	const normalized = name.toLowerCase();

	const first = normalized.charAt(0) || "_";
	const prefix = normalized.slice(0, PREFIX_LENGTH) || first;
	const shard = normalized.slice(0, SHARD_LENGTH) || prefix;

	return [first, prefix, shard];
}

/**
 * Computes sharded folder path parts for a dictionary entry.
 *
 * @param originalName - The word/file basename (e.g., "anfangen")
 * @param targetLanguage - Target language (e.g., "German")
 * @param unitKind - Linguistic unit kind (e.g., "Lexem")
 * @param surfaceKind - Surface kind (e.g., "Lemma")
 * @returns Path parts array: ["Worter", langCode, unitKind, surfaceKind, first, prefix, shard]
 */
export function computeShardedFolderParts(
	originalName: string,
	targetLanguage: TargetLanguage,
	unitKind: LinguisticUnitKind,
	surfaceKind: SurfaceKind,
): string[] {
	const langCode = LANGUAGE_ISO_CODE[targetLanguage];
	const segments = computeShardSegments(originalName);
	return [
		WORTER_ROOT,
		langCode,
		unitKind.toLowerCase(),
		surfaceKind.toLowerCase(),
		...segments,
	];
}
