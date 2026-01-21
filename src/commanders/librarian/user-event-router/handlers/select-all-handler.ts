import { isGoBackLine } from "../../../../managers/obsidian/navigation";
import type { SelectAllEvent } from "../../../../managers/obsidian/user-event-interceptor";
import { META_SECTION_PATTERN } from "../../../../managers/pure/note-metadata-manager";
import {
	splitFirstLine,
	splitFrontmatter,
} from "../../healer/library-tree/codex/transforms/transform-utils";

/**
 * Handle select-all: use smart range excluding frontmatter, go-back links, metadata.
 */
export function handleSelectAll(event: SelectAllEvent): void {
	const { content, preventDefault, setSelection } = event;

	const { from, to } = calculateSmartRange(content);

	// If the range covers everything or nothing, let default behavior handle it
	if ((from === 0 && to === content.length) || from >= to) {
		return;
	}

	preventDefault();
	setSelection(from, to);
}

/**
 * Calculate smart selection range that excludes:
 * 1. YAML frontmatter (--- ... ---)
 * 2. Go-back links at the start ([[__...]])
 * 3. Metadata section at the end (<section id="textfresser_meta...">)
 */
export function calculateSmartRange(content: string): {
	from: number;
	to: number;
} {
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
		let searchPos = 0;
		let currentLine = "";

		while (searchPos < contentAfterFrontmatter.length) {
			const remaining = contentAfterFrontmatter.slice(searchPos);
			const { firstLine, rest } = splitFirstLine(remaining);

			if (firstLine.trim().length === 0) {
				searchPos += firstLine.length;
				if (rest.length > 0 || remaining[firstLine.length] === "\n") {
					searchPos += 1;
				}
			} else {
				currentLine = firstLine;
				break;
			}
		}

		if (isGoBackLine(currentLine)) {
			from += searchPos + currentLine.length;
			if (from < content.length && content[from] === "\n") {
				from += 1;
			}
		}
	}

	// Step 3: Find metadata section start
	const metaMatch = content.match(META_SECTION_PATTERN);
	if (metaMatch && metaMatch.index !== undefined) {
		to = metaMatch.index;
	}

	// Trim trailing whitespace from selection
	while (to > from && /\s/.test(content[to - 1] ?? "")) {
		to--;
	}

	// Trim leading whitespace from selection (after go-back link)
	while (from < to && /\s/.test(content[from] ?? "")) {
		from++;
	}

	// Handle edge case where everything is excluded
	if (from >= to) {
		return { from: 0, to: 0 };
	}

	return { from, to };
}
