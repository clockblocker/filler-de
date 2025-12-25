import { getParsedUserSettings } from "../../../global-state/global-state";
import type { SplitPath } from "../../../obsidian-vault-action-manager/types/split-path";
import { CODEX_PREFIX } from "../types/literals";
import type { CoreNameChainFromRoot } from "../types/split-basename";
import type { TreeNode } from "../types/tree-node";
import { TreeNodeType } from "../types/tree-node";
import { parseBasename } from "./parse-basename";

/**
 * Build codex basename.
 * Reads settings internally.
 *
 * @param input - TreeNode or SplitPath
 * @returns Codex basename
 *   - TreeNode Section: codex for that section
 *   - TreeNode Scroll/File: codex for parent section
 *   - SplitPath Folder: codex for that folder (section)
 *   - SplitPath File: codex for parent section
 *
 * @example
 * // Section node: codex for that section
 * buildCodexBasename(sectionNode) // "__Section-Parent"
 *
 * // File node: codex for parent section
 * buildCodexBasename(fileNode) // "__Parent"
 *
 * // Folder SplitPath: codex for that folder
 * buildCodexBasename(folderSplitPath) // "__Folder"
 *
 * // File SplitPath: codex for parent section
 * buildCodexBasename(fileSplitPath) // "__Parent"
 */
export function buildCodexBasename(input: TreeNode | SplitPath): string {
	if ("type" in input && "coreName" in input) {
		return buildCodexBasenameFromNode(input);
	}
	return buildCodexBasenameFromSplitPath(input);
}

export function isBasenamePrefixedAsCodex(basename: string): boolean {
	return basename.startsWith(CODEX_PREFIX);
}

export function addCodexPrefix(sectionName: string): string {
	return `${CODEX_PREFIX}${sectionName}`;
}

/**
 * Internal helper: Build full codex basename from section chain.
 * Handles root sections (no suffix) and nested sections (with suffix).
 */
function buildCodexBasenameFromChain(
	sectionCoreName: string,
	sectionChain: CoreNameChainFromRoot,
	libraryRootBasename: string,
	suffixDelimiter: string,
): string {
	// Root section: use library root name, no suffix
	const sectionName =
		sectionChain.length === 0 ? libraryRootBasename : sectionCoreName;
	const coreCodexName = addCodexPrefix(sectionName);

	// Build suffix from parent chain (exclude self, reverse order)
	const suffix =
		sectionChain.length > 0
			? sectionChain
					.slice(0, -1) // Parent chain (exclude self)
					.reverse()
					.join(suffixDelimiter)
			: "";

	return suffix
		? `${coreCodexName}${suffixDelimiter}${suffix}`
		: coreCodexName;
}

/**
 * Build codex basename for a file's parent section.
 * Reads settings internally.
 */
function buildCodexBasenameFromSplitPath(splitPath: SplitPath): string {
	const settings = getParsedUserSettings();
	const libraryRoot = settings.splitPathToLibraryRoot.basename;

	// Extract parent section chain from pathParts
	// For files: pathParts = [libraryRoot, ...sectionChain]
	// For folders: pathParts = [libraryRoot, ...sectionChain] (folder is the section)
	const parts = splitPath.pathParts;
	const startIndex = parts[0] === libraryRoot ? 1 : 0;
	const sectionChain: CoreNameChainFromRoot = parts.slice(startIndex);

	if (splitPath.type === "Folder") {
		// Folder is a section, use its name
		const { coreName } = parseBasename(splitPath.basename);
		const fullChain = [...sectionChain, coreName];
		return buildCodexBasenameFromChain(
			coreName,
			fullChain,
			libraryRoot,
			settings.suffixDelimiter,
		);
	}

	// File: build codex for parent section
	// Parent section chain is sectionChain (pathParts after root)
	if (sectionChain.length === 0) {
		// File in root: codex is for root section
		return buildCodexBasenameFromChain(
			libraryRoot,
			[],
			libraryRoot,
			settings.suffixDelimiter,
		);
	}

	// File in nested section: get parent section name from chain
	const parentSectionName = sectionChain[sectionChain.length - 1];
	if (!parentSectionName) {
		// Fallback to root (should not happen, but type-safe)
		return buildCodexBasenameFromChain(
			libraryRoot,
			[],
			libraryRoot,
			settings.suffixDelimiter,
		);
	}
	return buildCodexBasenameFromChain(
		parentSectionName,
		sectionChain,
		libraryRoot,
		settings.suffixDelimiter,
	);
}

/**
 * Build codex basename from TreeNode.
 * Reads settings internally.
 */
function buildCodexBasenameFromNode(node: TreeNode): string {
	const settings = getParsedUserSettings();
	const libraryRoot = settings.splitPathToLibraryRoot.basename;

	if (node.type === TreeNodeType.Section) {
		// Section: build codex for this section
		const fullChain: CoreNameChainFromRoot = [
			...node.coreNameChainToParent,
			node.coreName,
		];
		return buildCodexBasenameFromChain(
			node.coreName,
			fullChain,
			libraryRoot,
			settings.suffixDelimiter,
		);
	}

	// Scroll/File: build codex for parent section
	// Parent section chain is node.coreNameChainToParent
	if (node.coreNameChainToParent.length === 0) {
		// File in root: codex is for root section
		return buildCodexBasenameFromChain(
			libraryRoot,
			[],
			libraryRoot,
			settings.suffixDelimiter,
		);
	}

	// File in nested section: get parent section name from chain
	const parentSectionName =
		node.coreNameChainToParent[node.coreNameChainToParent.length - 1];
	if (!parentSectionName) {
		// Fallback to root (should not happen, but type-safe)
		return buildCodexBasenameFromChain(
			libraryRoot,
			[],
			libraryRoot,
			settings.suffixDelimiter,
		);
	}
	return buildCodexBasenameFromChain(
		parentSectionName,
		node.coreNameChainToParent,
		libraryRoot,
		settings.suffixDelimiter,
	);
}
