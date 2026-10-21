/**
 * A metadata document: the JSON object one format holds for a note. The
 * hidden section holds one, and so does the frontmatter, where it shares
 * the mapping with the user's own properties.
 */
export type MetadataDocument = { readonly [key: string]: unknown };

export function isEmptyDocument(document: MetadataDocument): boolean {
	return Object.keys(document).length === 0;
}

/** Equal when both serialize to the same JSON, key order included. */
export function sameDocument(
	left: MetadataDocument,
	right: MetadataDocument,
): boolean {
	return JSON.stringify(left) === JSON.stringify(right);
}

/**
 * `document` with `entries` set and `remove` deleted. Keys that already
 * exist keep their position; new keys are appended in the order given.
 */
export function editDocument(
	document: MetadataDocument,
	entries: Readonly<Record<string, unknown>>,
	remove: readonly string[] = [],
): MetadataDocument {
	const next: Record<string, unknown> = { ...document };
	for (const key of remove) {
		if (entries[key] === undefined) delete next[key];
	}
	for (const [key, value] of Object.entries(entries)) {
		if (value === undefined) delete next[key];
		else next[key] = value;
	}
	return next;
}
