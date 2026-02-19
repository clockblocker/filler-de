/**
 * Keep the FIRST occurrence for each key.
 */
export function dedupeByKeyFirst<T>(
	items: ReadonlyArray<T>,
	getKey: (item: T) => string,
): T[] {
	const seen = new Set<string>();
	const result: T[] = [];
	for (const item of items) {
		const key = getKey(item);
		if (!seen.has(key)) {
			seen.add(key);
			result.push(item);
		}
	}
	return result;
}

/**
 * Keep the LAST occurrence for each key ("newest wins").
 */
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
