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
	// Handle page numbers: "000_coreName-suffix" -> "coreName-suffix"
	const pageNumberMatch = basename.match(/^(\d{3})_(.+)$/);
	const basenameWithoutPage = pageNumberMatch ? pageNumberMatch[2] : basename;

	const parts = basenameWithoutPage.split(suffixDelimiter);
	if (parts.length === 1) {
		return { coreName: parts[0], splitSuffix: [] };
	}

	const coreName = parts[0];
	const splitSuffix = parts.slice(1);

	return { coreName, splitSuffix };
}
