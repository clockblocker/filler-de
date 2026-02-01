/**
 * Types for TextfresserContext - the structured context from a wikilink click.
 */

export type TargetMatchesLemma = "Yes" | "No" | "Unverified";

export type TextfresserContext = {
	/** Formatted context: ![[basename#^blockId|^]] if block ID exists, else rawBlock */
	formattedContext: string;
	/** Raw paragraph/block content where the wikilink was clicked */
	rawBlock: string;
	/** Stripped text with only the target surface highlighted: [surface] */
	contextWithOnlyTargetSurfaceHighlited: string;
	/** The clicked word - alias if exists, else link target */
	target: string;
	/** Whether target matches the baseform */
	targetMatchesLemma: TargetMatchesLemma;
};

export type ContextError =
	| { kind: "NO_CLICK" }
	| { kind: "WIKILINK_NOT_FOUND" };

export function noClickError(): ContextError {
	return { kind: "NO_CLICK" };
}

export function wikilinkNotFoundError(): ContextError {
	return { kind: "WIKILINK_NOT_FOUND" };
}
