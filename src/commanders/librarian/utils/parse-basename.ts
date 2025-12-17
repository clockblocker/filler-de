import type { SplitBasename } from "../types/split-basename";

/**
 * Parse basename to extract coreName and splitSuffix.
 * Format: coreName-suffix1-suffix2-...-rootName
 *
 * @param basename - The basename without extension
 * @param suffixDelimiter - Delimiter used in basename (default: "-")
 * @returns SplitBasename with coreName and splitSuffix
 */
export function parseBasename(
	basename: string,
	suffixDelimiter = "-",
): SplitBasename {
	const parts = basename.split(suffixDelimiter);
	const [coreName = "", ...splitSuffix] = parts;

	return { coreName, splitSuffix };
}
