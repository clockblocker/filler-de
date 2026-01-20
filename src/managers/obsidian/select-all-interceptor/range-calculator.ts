/**
 * Range calculator for smart Ctrl+A selection.
 * Excludes go-back links, frontmatter, and metadata from selection.
 */

import {
	splitFirstLine,
	splitFrontmatter,
} from "../../../commanders/librarian/healer/library-tree/codex/transforms/transform-utils";
import { META_SECTION_PATTERN } from "../../pure/note-metadata-manager";
import { isGoBackLine } from "../navigation";

/**
 * Result of calculating smart selection range.
 */
export type SmartRange = {
	/** Start position (0-based character offset) */
	from: number;
	/** End position (0-based character offset) */
	to: number;
};

/**
 * Calculate smart selection range that excludes:
 * 1. YAML frontmatter (--- ... ---)
 * 2. Go-back links at the start ([[__...]])
 * 3. Metadata section at the end (<section id="textfresser_meta...">)
 *
 * @param content - Full document content
 * @returns Range with from/to positions
 */
export function calculateSmartRange(content: string): SmartRange {
	if (!content || content.length === 0) {
		return { from: 0, to: 0 };
	}

	let from = 0;
	let to = content.length;

	// Step 1: Skip frontmatter
	const { frontmatter } = splitFrontmatter(content);
	if (frontmatter) {
		from = frontmatter.length;
	}

	// Step 2: Skip go-back link (first line after frontmatter)
	const contentAfterFrontmatter = content.slice(from);
	if (contentAfterFrontmatter.length > 0) {
		const { firstLine, rest: afterFirstLine } = splitFirstLine(
			contentAfterFrontmatter,
		);

		if (isGoBackLine(firstLine)) {
			// Skip the first line and the newline after it
			from += firstLine.length;
			if (afterFirstLine.length > 0 || content[from] === "\n") {
				from += 1; // Skip the newline
			}
		}
	}

	// Step 3: Find metadata section start
	const metaMatch = content.match(META_SECTION_PATTERN);
	if (metaMatch && metaMatch.index !== undefined) {
		// Set 'to' to where metadata section begins (including leading newlines)
		to = metaMatch.index;
	}

	// Trim trailing whitespace from selection
	while (to > from && /\s/.test(content[to - 1])) {
		to--;
	}

	// Trim leading whitespace from selection (after go-back link)
	while (from < to && /\s/.test(content[from])) {
		from++;
	}

	// Handle edge case where everything is excluded
	if (from >= to) {
		return { from: 0, to: 0 };
	}

	return { from, to };
}
