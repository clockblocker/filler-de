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

	// Step 2: Skip leading whitespace/empty lines, then check for go-back link
	const contentAfterFrontmatter = content.slice(from);
	if (contentAfterFrontmatter.length > 0) {
		// Skip leading empty lines to find the first non-empty line
		let searchPos = 0;
		let currentLine = "";

		while (searchPos < contentAfterFrontmatter.length) {
			const remaining = contentAfterFrontmatter.slice(searchPos);
			const { firstLine, rest } = splitFirstLine(remaining);

			if (firstLine.trim().length === 0) {
				// Empty line - skip it and continue
				searchPos += firstLine.length;
				if (rest.length > 0 || remaining[firstLine.length] === "\n") {
					searchPos += 1; // Skip newline
				}
			} else {
				// Found non-empty line
				currentLine = firstLine;
				break;
			}
		}

		// Check if the first non-empty line is a go-back link
		if (isGoBackLine(currentLine)) {
			// Skip everything up to and including this line
			from += searchPos + currentLine.length;
			// Skip the trailing newline if present
			if (from < content.length && content[from] === "\n") {
				from += 1;
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
