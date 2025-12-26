import { err, ok, type Result } from "neverthrow";
import { getParsedUserSettings } from "../../../global-state/global-state";
import {
	type SplitPathToFolder,
	SplitPathType,
} from "../../../obsidian-vault-action-manager/types/split-path";
import type { SectionNode } from "../types/tree-node";
import { suffixedBasenameForСodexToParentSectionChainCodec } from "./codecs/suffixed-basename-for-codex-to-chain-codec";
import { suffixedBasenameToChainCodec } from "./codecs/suffixed-basename-to-chain-codec";
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
export function buildCodexBasename({
	coreNameChainToParent,
}: Pick<SectionNode, "coreNameChainToParent">): string;
export function buildCodexBasename(
	splitPathToFolderOrChain:
		| SplitPathToFolder
		| Pick<SectionNode, "coreNameChainToParent">,
): string {
	const settings = getParsedUserSettings();
	const libraryRoot = settings.splitPathToLibraryRoot.basename;

	if ("pathParts" in splitPathToFolderOrChain) {
		const pathParts = splitPathToFolderOrChain.pathParts;
		const startIndex = pathParts[0] === libraryRoot ? 1 : 0;
		const sectionChain: CoreNameChainFromRoot = pathParts.slice(startIndex);
		return suffixedBasenameForСodexToParentSectionChainCodec.encode(
			sectionChain,
		);
	}

	// It's CoreNameChainFromRoot - TypeScript should narrow this, but we assert for safety
	if (Array.isArray(splitPathToFolderOrChain)) {
		return suffixedBasenameForСodexToParentSectionChainCodec.encode(
			splitPathToFolderOrChain,
		);
	}

	return "Unreachable";
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
		suffixedBasenameToChainCodec.safeParse(suffixedBasename);

	const settings = getParsedUserSettings();
	const libraryRoot = settings.splitPathToLibraryRoot.basename;

	if (!parseResult.success) {
		const errorMessage = parseResult.error.issues
			.map((issue) => issue.message)
			.join("; ");
		return err(errorMessage);
	}

	const chain = parseResult.data;
	const lastCoreName = chain.pop();

	if (chain.length === 0 && lastCoreName !== libraryRoot) {
		return err(`Outside of library: ${suffixedBasename}`);
	}
	return ok(chain);
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

	// Path parts: library root + section chain
	const pathParts = [libraryRoot, ...sectionChain];

	return ok({
		basename: folderBasename,
		pathParts,
		type: SplitPathType.Folder,
	});
}
