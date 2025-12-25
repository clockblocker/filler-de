import { err, ok, type Result } from "neverthrow";
import { getParsedUserSettings } from "../../../global-state/global-state";
import {
	type SplitPathToFolder,
	SplitPathType,
} from "../../../obsidian-vault-action-manager/types/split-path";
import { suffixedBasenameForСodexToParentSectionChainCodec } from "./codecs/suffixed-basename-for-codex-to-chain-codec";
import type { CoreNameChainFromRoot } from "./parsed-basename";

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
	suffixedBasenameForСodex: string,
): Result<CoreNameChainFromRoot, string> {
	const parseResult =
		suffixedBasenameForСodexToParentSectionChainCodec.safeParse(
			suffixedBasenameForСodex,
		);
	if (!parseResult.success) {
		const errorMessage = parseResult.error.issues
			.map((issue) => issue.message)
			.join("; ");
		return err(errorMessage);
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
 * tryExtractingSplitPathToFolder("__-Library") // ok({ basename: "Library", pathParts: ["Library"], type: "Folder" })
 * tryExtractingSplitPathToFolder("__-Child-Parent") // ok({ basename: "Child", pathParts: ["Library", "Parent", "Child"], type: "Folder" })
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

	const settings = getParsedUserSettings();
	const libraryRoot = settings.splitPathToLibraryRoot.basename;
	const sectionChain = sectionChainResult.value;

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
