import { wikilinkHelper } from "../../../../../stateless-helpers/wikilink";

export function normalizeLemma(raw: string | null | undefined): string | null {
	const trimmed = raw?.trim();
	if (!trimmed || trimmed.length === 0) {
		return null;
	}
	const normalized = wikilinkHelper.normalizeLinkTarget(trimmed);
	return normalized.length > 0 ? normalized : null;
}

export function normalizeMorphologyKey(
	raw: string | null | undefined,
): string | null {
	const normalized = normalizeLemma(raw);
	return normalized ? normalized.toLowerCase() : null;
}
