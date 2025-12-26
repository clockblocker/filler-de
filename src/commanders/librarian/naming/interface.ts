import { err, ok, type Result } from "neverthrow";
import { getParsedUserSettings } from "../../../global-state/global-state";
import {
	type SplitPathToFolder,
	SplitPathType,
} from "../../../obsidian-vault-action-manager/types/split-path";
import type { SectionNode } from "../types/tree-node";
import { codexBasenameToSectionChainCodec } from "./codecs/suffixed-basename-for-codex-to-chain-codec";
import { treeNodeToSuffixedSplitPathCodec } from "./codecs/tree-node-to-split-path-codec";
import type { CoreNameChainFromRoot } from "./parsed-basename";

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
	section: Pick<SectionNode, "coreName" | "coreNameChainToParent">,
): string;
export function buildCodexBasename(
	splitPathToFolderOrSection:
		| SplitPathToFolder
		| Pick<SectionNode, "coreName" | "coreNameChainToParent">,
): string {
	if ("pathParts" in splitPathToFolderOrSection) {
		const sectionNode = treeNodeToSuffixedSplitPathCodec.encode(
			splitPathToFolderOrSection,
		);
		const fullChain = [
			...sectionNode.coreNameChainToParent,
			sectionNode.coreName,
		];
		return codexBasenameToSectionChainCodec.encode(fullChain);
	}

	const { coreName, coreNameChainToParent } = splitPathToFolderOrSection;
	const fullChain = [...coreNameChainToParent, coreName];
	return codexBasenameToSectionChainCodec.encode(fullChain);
}

/**
 * Extract core name chain to section from codex basename.
 * Reads settings internally.
 *
 * @param suffixedBasenameForСodex - Codex basename (e.g., "__-Library" or "__-Child-Parent")
 * @returns Result with core name chain from root to section (e.g., [] or ["Parent", "Child"])
 *
 * @example
 * tryExtractingCoreNameChainToSection("__-Library") // ok([])
 * tryExtractingCoreNameChainToSection("__-Child-Parent") // ok(["Parent", "Child"])
 * tryExtractingCoreNameChainToSection("Note") // err("Invalid codex basename: ...")
 */
export function tryExtractingCoreNameChainToSection(
	suffixedBasename: string,
): Result<CoreNameChainFromRoot, string> {
	const parseResult =
		codexBasenameToSectionChainCodec.safeParse(suffixedBasename);

	if (!parseResult.success) {
		const errorMessage = parseResult.error.issues
			.map((issue) => issue.message)
			.join("; ");
		return err(
			`Invalid codex basename: "${suffixedBasename}". ${errorMessage}`,
		);
	}

	return ok(parseResult.data);
}

/**
 * Build SplitPathToFolder for the section folder from codex basename.
 * Reads settings internally.
 *
 * @param suffixedBasenameForСodex - Codex basename (e.g., "__-Library" or "__-Child-Parent")
 * @returns Result with SplitPathToFolder for the section folder
 *
 * @example
 * tryExtractingSplitPathToFolder("__-Library") // ok({ basename: "Library", pathParts: [], type: "Folder" })
 * tryExtractingSplitPathToFolder("__-Child-Parent") // ok({ basename: "Child", pathParts: ["Library", "Parent"], type: "Folder" })
 * tryExtractingSplitPathToFolder("Note") // err("Invalid codex basename: ...")
 */
export function tryExtractingSplitPathToFolder(
	suffixedBasenameForСodex: string,
): Result<SplitPathToFolder, string> {
	const sectionChainResult = tryExtractingCoreNameChainToSection(
		suffixedBasenameForСodex,
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
