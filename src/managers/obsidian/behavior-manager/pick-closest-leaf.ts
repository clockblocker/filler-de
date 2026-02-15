/**
 * Pick the best matching leaf from multiple candidates.
 * Uses longest common path prefix with the active file to determine proximity.
 */

import type { LeafMatch } from "../../../commanders/librarian/healer/library-tree/tree";
import type { NonEmptyArray } from "../../../types/helpers";

/**
 * Pick the leaf whose pathParts share the longest common prefix with currentPathParts.
 * Tie-break: shallower depth (fewer pathParts). Fallback: first match.
 *
 * @param matches - Non-empty array of leaf matches
 * @param currentPathParts - Path parts of the active file (e.g. ["Library", "word", "german"])
 */
export function pickClosestLeaf(
	matches: NonEmptyArray<LeafMatch>,
	currentPathParts: string[],
): LeafMatch {
	if (matches.length === 1) return matches[0];

	let best = matches[0];
	let bestPrefix = commonPrefixLength(best.pathParts, currentPathParts);

	for (let i = 1; i < matches.length; i++) {
		const m = matches[i];
		if (!m) continue;
		const prefix = commonPrefixLength(m.pathParts, currentPathParts);

		if (
			prefix > bestPrefix ||
			(prefix === bestPrefix &&
				m.pathParts.length < best.pathParts.length)
		) {
			best = m;
			bestPrefix = prefix;
		}
	}

	return best;
}

function commonPrefixLength(a: string[], b: string[]): number {
	const len = Math.min(a.length, b.length);
	let count = 0;
	for (let i = 0; i < len; i++) {
		if (a[i] !== b[i]) break;
		count++;
	}
	return count;
}
