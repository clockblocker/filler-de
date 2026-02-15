/** Result of a corename lookup in the tree. */
export type LeafMatch = {
	/** Folder names root→parent (e.g. ["Library", "word", "german"]) */
	pathParts: string[];
	/** Pre-computed suffixed basename for wikilink target */
	basename: string;
};
