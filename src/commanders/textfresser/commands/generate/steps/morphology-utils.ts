export function normalizeLemma(raw: string | null | undefined): string | null {
	const trimmed = raw?.trim();
	return trimmed && trimmed.length > 0 ? trimmed : null;
}

export function normalizeMorphologyKey(
	raw: string | null | undefined,
): string | null {
	const normalized = normalizeLemma(raw);
	return normalized ? normalized.toLowerCase() : null;
}
