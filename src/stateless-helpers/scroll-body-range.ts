/**
 * The range of a note's body: what follows its YAML frontmatter and its
 * go-back link, up to its metadata section. Smart select-all selects it,
 * and Classify reads Sentences only inside it. An empty range is
 * `{ from: 0, to: 0 }`.
 */
import { goBackLinkHelper } from "@textfresser/note-addressing";
import { noteMetadataHelper } from "./note-metadata";

export function scrollBodyRange(content: string): { from: number; to: number } {
	if (!content || content.length === 0) {
		return { from: 0, to: 0 };
	}

	let from = 0;
	let to = content.length;

	// Step 1: Skip YAML frontmatter (not JSON - that's at the end)
	const afterFrontmatter = noteMetadataHelper.stripOnlyFrontmatter(content);
	if (afterFrontmatter.length < content.length) {
		from = content.length - afterFrontmatter.length;
	}

	// Step 2: Skip go-back link
	const afterGoBack = goBackLinkHelper.strip(afterFrontmatter);
	if (afterGoBack.length < afterFrontmatter.length) {
		from += afterFrontmatter.length - afterGoBack.length;
	}

	// Step 3: Find metadata section start (already excludes preceding whitespace)
	const metaSectionStart = noteMetadataHelper.findSectionStart(content);
	if (metaSectionStart !== null) {
		to = metaSectionStart;
	}

	// Handle edge case where everything is excluded
	if (from >= to) {
		return { from: 0, to: 0 };
	}

	return { from, to };
}
