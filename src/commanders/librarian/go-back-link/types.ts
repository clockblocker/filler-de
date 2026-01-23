/**
 * Types for go-back link module.
 */

/**
 * Parsed go-back link information.
 */
export type GoBackLinkInfo = {
	/** The full wikilink (including [[ and ]]) */
	fullLink: string;
	/** The suffix part (e.g., "L4-L3-L2-L1" or " ;; Struwwelpeter ;; ...") */
	suffix: string;
	/** The display name after the arrow (e.g., "L4" or "Struwwelpeter") */
	displayName: string;
};
