import type {
	AnySplitPath,
	SplitPathToFolder,
} from "@textfresser/vault-action-manager";
import { Effect } from "effect";
import type { NodeName } from "../../../types/schemas/node-name";
import { TreeNodeKind } from "../tree-node/types/atoms";
import type { SectionNode } from "../tree-node/types/tree-node";

/**
 * Extracts duplicate marker (e.g., " 1", " 2") from end of string.
 * Returns the clean string and the marker (or empty string if none).
 */
const extractDuplicateMarker = (
	name: string,
): { cleanName: string; marker: string; number: number | null } => {
	const match = name.match(/^(.+?)( (\d+))$/);
	if (match?.[1] && match[2] && match[3]) {
		return {
			cleanName: match[1],
			marker: match[2],
			number: Number.parseInt(match[3], 10),
		};
	}
	return { cleanName: name, marker: "", number: null };
};

/**
 * Builds a name with a duplicate marker.
 */
const buildNameWithDuplicateMarker = (
	cleanName: string,
	number: number,
): string => {
	return `${cleanName} ${number}`;
};

/**
 * Strip trailing " N" repeatedly to get the root base (e.g. "Untitled 2 1" → "Untitled").
 */
export function getRootBaseName(name: string): string {
	let cur = name;
	for (;;) {
		const { cleanName, number } = extractDuplicateMarker(cur);
		if (number === null) return cur;
		cur = cleanName;
	}
}

/**
 * Collect numbers already used in section for a root base: bare "root" counts as 1,
 * "root N" counts as N. Returns set of used numbers.
 */
function collectUsedNumbersForRootInSection(
	section: SectionNode,
	rootBase: string,
): Set<number> {
	const used = new Set<number>();
	for (const node of Object.values(section.children)) {
		if (node.kind === TreeNodeKind.Section) continue;
		const name = node.nodeName;
		const { cleanName, number } = extractDuplicateMarker(name);
		if (cleanName !== rootBase) continue;
		if (number === null) used.add(1);
		else used.add(number);
	}
	return used;
}

/**
 * Given a section and a base name, returns the next available name so it does not
 * collide with existing leaf nodeNames. Uses "baseName 1", "baseName 2", etc.
 * When baseName looks like "Untitled 2 1" (Obsidian duplicate), normalizes to the
 * next in the root sequence (e.g. "Untitled 3"). No vault I/O — scans section.children only.
 */
export function resolveNextAvailableNameInSection(
	section: SectionNode,
	baseName: NodeName,
): NodeName {
	const { number: firstNumber } = extractDuplicateMarker(baseName);

	// Obsidian duplicate: "Untitled 2 1" → normalize to next in "Untitled" sequence
	if (firstNumber !== null) {
		const rootBase = getRootBaseName(baseName);
		if (rootBase !== baseName) {
			const used = collectUsedNumbersForRootInSection(section, rootBase);
			let next = 1;
			while (used.has(next)) next++;
			return buildNameWithDuplicateMarker(rootBase, next) as NodeName;
		}
	}

	const existingNumbers = new Set<number>();
	let baseNameTaken = false;
	for (const node of Object.values(section.children)) {
		if (node.kind === TreeNodeKind.Section) continue;
		const { cleanName, number } = extractDuplicateMarker(node.nodeName);
		if (cleanName !== baseName) continue;
		if (number === null) baseNameTaken = true;
		else existingNumbers.add(number);
	}
	if (!baseNameTaken) return baseName;
	let n = 1;
	while (existingNumbers.has(n)) n++;
	return buildNameWithDuplicateMarker(baseName, n) as NodeName;
}



