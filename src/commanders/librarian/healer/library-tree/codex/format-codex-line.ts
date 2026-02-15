/**
 * Formatters for codex lines.
 * Pure functions that produce markdown strings for codex entries.
 */

import { getParsedUserSettings } from "../../../../../global-state/global-state";
import {
	DASH,
	DONE_CHECKBOX,
	NOT_STARTED_CHECKBOX,
	OBSIDIAN_LINK_CLOSE,
	OBSIDIAN_LINK_OPEN,
	PIPE,
	SPACE_F,
} from "../../../../../types/literals/ui";
import { makeCodecRulesFromSettings, makeCodecs } from "../../../codecs";
import {
	computeCodexSuffix,
	pathPartsWithRootToSuffixParts,
} from "../../../paths/path-finder";
import type { TreeNodeStatus } from "../tree-node/types/atoms";
import { TreeNodeStatus as Status } from "../tree-node/types/atoms";
import { PREFIX_OF_CODEX } from "./literals";

// ─── Helpers ───

function formatBacklink(basename: string, displayName: string): string {
	return `${OBSIDIAN_LINK_OPEN}${basename}${PIPE}${displayName}${OBSIDIAN_LINK_CLOSE}`;
}

function checkbox(status: TreeNodeStatus): string {
	return status === Status.Done ? DONE_CHECKBOX : NOT_STARTED_CHECKBOX;
}

/**
 * Build canonical basename for a leaf (scroll/file).
 * coreName + suffix from path.
 */
function makeLeafBasename(nodeName: string, pathParts: string[]): string {
	const settings = getParsedUserSettings();
	const rules = makeCodecRulesFromSettings(settings);
	const codecs = makeCodecs(rules);
	const suffixParts = pathPartsWithRootToSuffixParts(pathParts);
	return codecs.suffix.serializeSeparatedSuffix({
		coreName: nodeName,
		suffixParts,
	});
}

/**
 * Build canonical basename for a section's codex file.
 * "__" + suffix from section's full path.
 *
 * Special case: root codex includes Library name in suffix.
 * - ["Library"] → "__-Library"
 * - ["Library", "A"] → "__-A"
 * - ["Library", "A", "B"] → "__-B-A"
 */
export function makeCodexBasename(sectionPathParts: string[]): string {
	const settings = getParsedUserSettings();
	const rules = makeCodecRulesFromSettings(settings);
	const codecs = makeCodecs(rules);
	const suffixParts = computeCodexSuffix(sectionPathParts);

	return codecs.suffix.serializeSeparatedSuffix({
		coreName: PREFIX_OF_CODEX,
		suffixParts,
	});
}

// ─── Public Formatters ───

/**
 * Format a scroll (md file) line for codex.
 *
 * @param nodeName - display name of the scroll
 * @param pathParts - full path including Library root, e.g. ["Library", "A"]
 * @param status - scroll status
 * @returns e.g. "- [ ] [[Note-A|Note]]"
 */
export function formatScrollLine(
	nodeName: string,
	pathParts: string[],
	status: TreeNodeStatus,
): string {
	const basename = makeLeafBasename(nodeName, pathParts);
	const backlink = formatBacklink(basename, nodeName);
	return `${checkbox(status)}${SPACE_F}${backlink}`;
}

/**
 * Format a file (non-md) line for codex.
 *
 * @param nodeName - display name of the file
 * @param pathParts - full path including Library root
 * @returns e.g. "- [[image-A|image]]"
 */
export function formatFileLine(nodeName: string, pathParts: string[]): string {
	const basename = makeLeafBasename(nodeName, pathParts);
	const backlink = formatBacklink(basename, nodeName);
	return `${DASH}${SPACE_F}${backlink}`;
}

/**
 * Format a child section line for codex.
 * Links to the section's codex file.
 *
 * @param sectionName - display name of the section
 * @param parentPathParts - path to parent section (including Library root)
 * @param status - aggregated status of the section
 * @returns e.g. "- [ ] [[__-A|A]]"
 */
export function formatChildSectionLine(
	sectionName: string,
	parentPathParts: string[],
	status: TreeNodeStatus,
): string {
	// Section's full path = parent path + section name
	const sectionPathParts = [...parentPathParts, sectionName];
	const codexBasename = makeCodexBasename(sectionPathParts);
	const backlink = formatBacklink(codexBasename, sectionName);
	return `${checkbox(status)}${SPACE_F}${backlink}`;
}
