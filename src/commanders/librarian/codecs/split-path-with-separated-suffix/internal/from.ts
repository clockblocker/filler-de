import {
	SplitPathKind,
	type SplitPathKind as SplitPathKindType,
} from "../../../../../managers/obsidian/vault-action-manager/types/split-path";
import type { SuffixCodecs } from "../../internal/suffix";
import type {
	AnySplitPathInsideLibrary,
	SplitPathInsideLibraryOf,
	SplitPathToFileInsideLibrary,
	SplitPathToFolderInsideLibrary,
	SplitPathToMdFileInsideLibrary,
} from "../../split-path-inside-library";
import type { SplitPathInsideLibraryWithSeparatedSuffixOf } from "../types";

type AnySplitPathInsideLibraryWithSeparatedSuffix =
	| SplitPathInsideLibraryWithSeparatedSuffixOf<typeof SplitPathKind.Folder>
	| SplitPathInsideLibraryWithSeparatedSuffixOf<typeof SplitPathKind.File>
	| SplitPathInsideLibraryWithSeparatedSuffixOf<typeof SplitPathKind.MdFile>;

/**
 * Converts split path with separated suffix to regular split path inside library.
 * Serializes separated suffix into basename.
 */
export function fromSplitPathInsideLibraryWithSeparatedSuffix<
	SK extends SplitPathKindType,
>(
	suffix: SuffixCodecs,
	sp: SplitPathInsideLibraryWithSeparatedSuffixOf<SK>,
): SplitPathInsideLibraryOf<SK>;
export function fromSplitPathInsideLibraryWithSeparatedSuffix(
	suffix: SuffixCodecs,
	sp: SplitPathInsideLibraryWithSeparatedSuffixOf<typeof SplitPathKind.Folder>,
): SplitPathToFolderInsideLibrary;
export function fromSplitPathInsideLibraryWithSeparatedSuffix(
	suffix: SuffixCodecs,
	sp: SplitPathInsideLibraryWithSeparatedSuffixOf<typeof SplitPathKind.File>,
): SplitPathToFileInsideLibrary;
export function fromSplitPathInsideLibraryWithSeparatedSuffix(
	suffix: SuffixCodecs,
	sp: SplitPathInsideLibraryWithSeparatedSuffixOf<typeof SplitPathKind.MdFile>,
): SplitPathToMdFileInsideLibrary;
export function fromSplitPathInsideLibraryWithSeparatedSuffix(
	suffix: SuffixCodecs,
	sp: AnySplitPathInsideLibraryWithSeparatedSuffix,
): AnySplitPathInsideLibrary {
	const basename = suffix.serializeSeparatedSuffix(
		sp.separatedSuffixedBasename,
	);

	switch (sp.kind) {
		case SplitPathKind.Folder:
			return {
				basename,
				kind: SplitPathKind.Folder,
				pathParts: sp.pathParts,
			};
		case SplitPathKind.File:
			return {
				basename,
				extension: sp.extension,
				kind: SplitPathKind.File,
				pathParts: sp.pathParts,
			};
		case SplitPathKind.MdFile:
			return {
				basename,
				extension: sp.extension,
				kind: SplitPathKind.MdFile,
				pathParts: sp.pathParts,
			};
	}
}
