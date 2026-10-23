/**
 * Parse codex line content from checkbox click.
 * Extracts link target and converts to locator.
 */

import { Result } from "effect";
import type { Codecs } from "../../../codecs";
import type { SectionNodeSegmentId } from "../../../codecs/segment-id";
import { NodeSegmentIdSeparator } from "../../../codecs/segment-id/types/segment-id";
import { TreeNodeKind } from "../tree-node/types/atoms";
import { PREFIX_OF_CODEX } from "./literals";

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
 * @param codecs - Codec API, for the suffix delimiter and Library root
 * @returns Parsed target or error
 */
export function parseCodexClickLineContent(
	lineContent: string,
	codecs: Codecs,
): Result.Result<CodexClickTarget, string> {
	// Extract link target from [[target|alias]] or [[target]]
	const linkMatch = lineContent.match(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/);
	if (!linkMatch?.[1]) {
		return Result.fail("No link found in line content");
	}

	const linkTarget = linkMatch[1];

	return parseCodexLinkTarget(linkTarget, codecs);
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
	codecs: Codecs,
): Result.Result<CodexClickTarget, string> {
	const libraryRoot = codecs.rules.libraryRootName;

	// Parse as suffixed basename
	const parseResult = Result.mapError(
		codecs.suffix.parseSeparatedSuffix(linkTarget),
		(error) => error.message,
	);

	if (Result.isFailure(parseResult)) {
		return Result.fail(
			`Failed to parse link target: ${parseResult.failure}`,
		);
	}

	const { coreName, suffixParts } = parseResult.success;

	if (coreName === PREFIX_OF_CODEX) {
		// Section codex: suffixParts are section names (deepest first)
		// e.g., "__-Child-Parent" → ["Child", "Parent"]
		// Chain: [Library, Parent, Child]
		const sectionChain = buildSectionChain(libraryRoot, suffixParts);
		return Result.succeed({
			kind: "Section",
			sectionChain,
		});
	}

	// Scroll: suffixParts are parent section names (deepest first)
	// e.g., "Note-Child-Parent" → coreName="Note", suffixParts=["Child", "Parent"]
	// parentChain: [Library, Parent, Child]
	const parentChain = buildSectionChain(libraryRoot, suffixParts);
	return Result.succeed({
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
