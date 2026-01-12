/**
 * Parse codex line content from checkbox click.
 * Extracts link target and converts to locator.
 */

import { err, ok, type Result } from "neverthrow";
import { getParsedUserSettings } from "../../../../../global-state/global-state";
import type { SectionNodeSegmentId } from "../../../codecs/segment-id";
import { NodeSegmentIdSeparator } from "../../../codecs/segment-id/types/segment-id";
import { tryParseAsSeparatedSuffixedBasename } from "../tree-action/utils/canonical-naming/suffix-utils/core-suffix-utils";
import { TreeNodeKind } from "../tree-node/types/atoms";
import { CODEX_CORE_NAME } from "./literals";

// ─── Types ───

export type CodexClickTarget =
	| {
			kind: "Scroll";
			/** Full chain to scroll's parent section */
			parentChain: SectionNodeSegmentId[];
			/** Scroll node name */
			nodeName: string;
	  }
	| {
			kind: "Section";
			/** Full chain to section */
			sectionChain: SectionNodeSegmentId[];
	  };

// ─── Main ───

/**
 * Parse line content from codex checkbox click.
 *
 * Expected format: `[[linkTarget|displayName]]` or `[[linkTarget]]`
 *
 * @param lineContent - Line content after "- [ ] " stripped
 * @returns Parsed target or error
 */
export function parseCodexClickLineContent(
	lineContent: string,
): Result<CodexClickTarget, string> {
	// Extract link target from [[target|alias]] or [[target]]
	const linkMatch = lineContent.match(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/);
	if (!linkMatch?.[1]) {
		return err("No link found in line content");
	}

	const linkTarget = linkMatch[1];

	return parseCodexLinkTarget(linkTarget);
}

/**
 * Parse a codex link target into a click target.
 *
 * Link target formats:
 * - Scroll: `ScrollName-Section-Parent` (suffixed basename)
 * - Section codex: `__-Section-Parent` (codex file)
 */
export function parseCodexLinkTarget(
	linkTarget: string,
): Result<CodexClickTarget, string> {
	const settings = getParsedUserSettings();
	const libraryRoot = settings.splitPathToLibraryRoot.basename;

	// Parse as suffixed basename
	const parseResult = tryParseAsSeparatedSuffixedBasename({
		basename: linkTarget,
	});

	if (parseResult.isErr()) {
		return err(`Failed to parse link target: ${parseResult.error}`);
	}

	const { coreName, suffixParts } = parseResult.value;

	// Check if it's a section codex (coreName === "__")
	if (coreName === CODEX_CORE_NAME) {
		// Section codex: suffixParts are section names (deepest first)
		// e.g., "__-Child-Parent" → ["Child", "Parent"]
		// Chain: [Library, Parent, Child]
		const sectionChain = buildSectionChain(libraryRoot, suffixParts);
		return ok({
			kind: "Section",
			sectionChain,
		});
	}

	// Scroll: suffixParts are parent section names (deepest first)
	// e.g., "Note-Child-Parent" → coreName="Note", suffixParts=["Child", "Parent"]
	// parentChain: [Library, Parent, Child]
	const parentChain = buildSectionChain(libraryRoot, suffixParts);
	return ok({
		kind: "Scroll",
		nodeName: coreName,
		parentChain,
	});
}

// ─── Helpers ───

function buildSectionChain(
	libraryRoot: string,
	suffixParts: string[],
): SectionNodeSegmentId[] {
	// suffixParts are reversed (deepest first), so reverse them
	// Then prepend library root
	const pathParts = [libraryRoot, ...suffixParts.slice().reverse()];

	return pathParts.map(
		(name) =>
			`${name}${NodeSegmentIdSeparator}${TreeNodeKind.Section}${NodeSegmentIdSeparator}` as SectionNodeSegmentId,
	);
}
