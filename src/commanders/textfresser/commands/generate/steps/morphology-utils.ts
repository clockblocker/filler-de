export function normalizeLemma(raw: string | null | undefined): string | null {
	const trimmed = raw?.trim();
	return trimmed && trimmed.length > 0 ? trimmed : null;
}
