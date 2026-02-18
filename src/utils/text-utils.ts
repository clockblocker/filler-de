export function extractHashTags(text: string): string[] {
	return text.match(/#[^\s]+/g) ?? [];
}
