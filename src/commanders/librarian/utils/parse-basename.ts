import { getParsedUserSettings } from "../../../global-state/global-state";
import type { SplitBasename } from "../types/split-basename";

/**
 * Parse basename to extract coreName and splitSuffix.
 * Reads suffixDelimiter from global settings.
 * Format: coreName-suffix1-suffix2-...-rootName
 *
 * @param basename - The basename without extension
 * @returns SplitBasename with coreName and splitSuffix
 */
export function parseBasename(basename: string): SplitBasename {
	const suffixDelimiter = getParsedUserSettings().suffixDelimiter;
	const parts = basename.split(suffixDelimiter);
	const [coreName = "", ...splitSuffix] = parts;

	return { coreName, splitSuffix };
}
