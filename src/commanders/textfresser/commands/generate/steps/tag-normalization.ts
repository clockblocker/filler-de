export function normalizeTagPart(value: string): string {
	return value.trim().toLowerCase().replace(/\s+/g, "-");
}
