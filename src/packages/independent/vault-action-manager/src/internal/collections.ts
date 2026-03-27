export function dedupeByKeyLast<T>(
	items: ReadonlyArray<T>,
	keyFn: (item: T) => string,
): T[] {
	const map = new Map<string, T>();
	for (const item of items) {
		map.set(keyFn(item), item);
	}
	return Array.from(map.values());
}
