import { err, ok, type Result } from "neverthrow";
import { getParsedUserSettings } from "../../../global-state/global-state";
import {
	type SplitPathToFolder,
	type SplitPathToMdFile,
	SplitPathType,
} from "../../../obsidian-vault-action-manager/types/split-path";
import type { SectionNode } from "../types/tree-node";
import { codexBasenameToSectionChainCodec } from "./codecs/suffixed-basename-for-codex-to-chain-codec";
import { treeNodeToSuffixedSplitPathCodec } from "./codecs/tree-node-to-split-path-codec";
import type { NodeNameChain } from "./schemas/node-name";

/**
 * Build codex basename from section folder path.
 * Reads settings internally.
 *
 * @param splitPathToFolder - Section folder path
 * @returns Codex basename (e.g., "__-Library" or "__-Child-Parent")
 *
 * @example
 * buildCodexBasename({ basename: "Library", pathParts: [], type: "Folder" }) // "__-Library"
 * buildCodexBasename({ basename: "Child", pathParts: ["Library", "Parent"], type: "Folder" }) // "__-Child-Parent"
 */
export function buildCodexBasename(
	splitPathToFolder: SplitPathToFolder,
): string;
/**
 * Build codex basename from parent section chain.
 * Reads settings internally.
 *
 * @param chain - Parent section chain from root (e.g., [] for root, ["Parent"] for nested)
 * @returns Codex basename (e.g., "__-Library" or "__-Child-Parent")
 *
 * @example
 * buildCodexBasename([]) // "__-Library"
 * buildCodexBasename(["Parent"]) // "__-Child-Parent"
 */
export function buildCodexBasename(
	section: Pick<SectionNode, "nodeName" | "nodeNameChainToParent">,
): string;
export function buildCodexBasename(
	splitPathToFolderOrSection:
		| SplitPathToFolder
		| Pick<SectionNode, "nodeName" | "nodeNameChainToParent">,
): string {
	if ("pathParts" in splitPathToFolderOrSection) {
		const sectionNode = treeNodeToSuffixedSplitPathCodec.encode(
			splitPathToFolderOrSection,
		);
		const fullChain = [
			...sectionNode.nodeNameChainToParent,
			sectionNode.nodeName,
		];
		return codexBasenameToSectionChainCodec.encode(fullChain);
	}

	const { nodeName, nodeNameChainToParent } = splitPathToFolderOrSection;
	const fullChain = [...nodeNameChainToParent, nodeName];
	return codexBasenameToSectionChainCodec.encode(fullChain);
}

export function tryBuildingSplitpathToCodex(
	canonicalBasenameForCodex: string,
): Result<SplitPathToMdFile, string> {
	const sectionChainResult = tryExtractingNodeNameChainToSection(
		canonicalBasenameForCodex,
	);

	if (sectionChainResult.isErr()) {
		return err(sectionChainResult.error);
	}

	const sectionChain = sectionChainResult.value;

	const pathParts = [libraryRoot, ...sectionChain.slice(0, -1)];
	const basename = sectionChain[sectionChain.length - 1] ?? libraryRoot;
	if (!basename) {
		return err("Failed to build codex basename");
	}

	return ok({
		basename,
		extension: "md",
		pathParts: [libraryRoot, ...sectionChain.slice(0, -1)],
		type: SplitPathType.MdFile,
	});
}

/**
 * Extract core name chain to section from codex basename.
 * Reads settings internally.
 *
 * @param canonicalBasenameForСodex - Codex basename (e.g., "__-Library" or "__-Child-Parent")
 * @returns Result with core name chain from root to section (e.g., [] or ["Parent", "Child"])
 *
 * @example
 * tryExtractingNodeNameChainToSection("__-Library") // ok([])
 * tryExtractingNodeNameChainToSection("__-Child-Parent") // ok(["Parent", "Child"])
 * tryExtractingNodeNameChainToSection("Note") // err("Invalid codex basename: ...")
 */
export function tryExtractingNodeNameChainToSection(
	canonicalBasename: string,
): Result<NodeNameChain, string> {
	const parseResult =
		codexBasenameToSectionChainCodec.safeParse(canonicalBasename);

	if (!parseResult.success) {
		const errorMessage = parseResult.error.issues
			.map((issue) => issue.message)
			.join("; ");
		return err(
			`Invalid codex basename: "${canonicalBasename}". ${errorMessage}`,
		);
	}

	return ok(parseResult.data);
}

/**
 * Build SplitPathToFolder for the section folder from codex basename.
 * Reads settings internally.
 *
 * @param canonicalBasenameForСodex - Codex basename (e.g., "__-Library" or "__-Child-Parent")
 * @returns Result with SplitPathToFolder for the section folder
 *
 * @example
 * tryExtractingSplitPathToFolder("__-Library") // ok({ basename: "Library", pathParts: [], type: "Folder" })
 * tryExtractingSplitPathToFolder("__-Child-Parent") // ok({ basename: "Child", pathParts: ["Library", "Parent"], type: "Folder" })
 * tryExtractingSplitPathToFolder("Note") // err("Invalid codex basename: ...")
 */
export function tryExtractingSplitPathToFolder(
	canonicalBasenameForСodex: string,
): Result<SplitPathToFolder, string> {
	const sectionChainResult = tryExtractingNodeNameChainToSection(
		canonicalBasenameForСodex,
	);
	if (sectionChainResult.isErr()) {
		return err(sectionChainResult.error);
	}
	const sectionChain = sectionChainResult.value;

	const settings = getParsedUserSettings();
	const libraryRoot = settings.splitPathToLibraryRoot.basename;

	// Folder basename is the last element of chain, or libraryRoot if empty
	const lastInChain = sectionChain[sectionChain.length - 1];
	const folderBasename = lastInChain ?? libraryRoot;

	// Path parts: library root + section chain (excluding basename)
	// For root case (empty chain), pathParts is empty
	const pathParts =
		sectionChain.length === 0
			? []
			: [libraryRoot, ...sectionChain.slice(0, -1)];

	return ok({
		basename: folderBasename,
		pathParts,
		type: SplitPathType.Folder,
	});
}
