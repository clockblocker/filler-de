import { getParsedUserSettings } from "../../../../../../../global-state/global-state";
import { SplitPathType } from "../../../../../../../obsidian-vault-action-manager/types/split-path";
import type {
	SplitPathInsideLibrary,
	SplitPathToFileInsideLibrary,
	SplitPathToFolderInsideLibrary,
	SplitPathToMdFileInsideLibrary,
} from "../../../bulk-vault-action-adapter/layers/library-scope/types/inside-library-split-paths";
import type { CanonicalSeparatedSuffixedBasename } from "../types";
import { splitBySuffixDelimiter } from "./core-suffix-utils";

export function buildCanonicalSeparatedSuffixedBasenamePathKingWay(
	sp: SplitPathToFolderInsideLibrary,
): CanonicalSeparatedSuffixedBasename;
export function buildCanonicalSeparatedSuffixedBasenamePathKingWay(
	sp: SplitPathToFileInsideLibrary,
): CanonicalSeparatedSuffixedBasename;
export function buildCanonicalSeparatedSuffixedBasenamePathKingWay(
	sp: SplitPathToMdFileInsideLibrary,
): CanonicalSeparatedSuffixedBasename;
export function buildCanonicalSeparatedSuffixedBasenamePathKingWay(
	sp: SplitPathInsideLibrary,
): CanonicalSeparatedSuffixedBasename;
export function buildCanonicalSeparatedSuffixedBasenamePathKingWay(
	sp: SplitPathInsideLibrary,
): CanonicalSeparatedSuffixedBasename {
	switch (sp.type) {
		case SplitPathType.File:
			return buildCanonicalSeparatedSuffixedBasenameForFile(sp);
		case SplitPathType.Folder:
			return buildCanonicalSeparatedSuffixedBasenameForFolder(sp);
		case SplitPathType.MdFile:
			return buildCanonicalSeparatedSuffixedBasenameForFile(sp);
	}
}

function buildCanonicalSeparatedSuffixedBasenameForFile(
	sp: SplitPathToFileInsideLibrary | SplitPathToMdFileInsideLibrary,
): CanonicalSeparatedSuffixedBasename {
	const { splitPathToLibraryRoot } = getParsedUserSettings();
	const libraryRootName = splitPathToLibraryRoot.basename;
	const pathPartsForSuffix =
		sp.pathParts.length > 0 && sp.pathParts[0] === libraryRootName
			? sp.pathParts.slice(1)
			: sp.pathParts;

	return {
		separatedSuffixedBasename: {
			coreName: splitBySuffixDelimiter(sp.basename)[0] ?? "",
			suffixParts: [...pathPartsForSuffix].reverse(),
		},
	};
}

function buildCanonicalSeparatedSuffixedBasenameForFolder(
	sp: SplitPathToFolderInsideLibrary,
): CanonicalSeparatedSuffixedBasename {
	return {
		separatedSuffixedBasename: {
			coreName: splitBySuffixDelimiter(sp.basename)[0] ?? "",
			suffixParts: [],
		},
	};
}
