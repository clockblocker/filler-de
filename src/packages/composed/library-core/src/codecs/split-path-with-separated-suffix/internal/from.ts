import {
	SplitPathKind,
	type SplitPathKind as SplitPathKindType,
} from "@textfresser/vault-action-manager/types/split-path";
import type { SuffixCodecs } from "../../internal/suffix";
import type {
	SplitPathInsideLibraryOf,
	SplitPathToFileInsideLibrary,
	SplitPathToFolderInsideLibrary,
	SplitPathToMdFileInsideLibrary,
} from "../../split-path-inside-library";
import type { SplitPathInsideLibraryWithSeparatedSuffixOf } from "../types";

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
	sp: SplitPathInsideLibraryWithSeparatedSuffixOf<
		typeof SplitPathKind.Folder
	>,
): SplitPathToFolderInsideLibrary;
export function fromSplitPathInsideLibraryWithSeparatedSuffix(
	suffix: SuffixCodecs,
	sp: SplitPathInsideLibraryWithSeparatedSuffixOf<typeof SplitPathKind.File>,
): SplitPathToFileInsideLibrary;
export function fromSplitPathInsideLibraryWithSeparatedSuffix(
	suffix: SuffixCodecs,
	sp: SplitPathInsideLibraryWithSeparatedSuffixOf<
		typeof SplitPathKind.MdFile
	>,
): SplitPathToMdFileInsideLibrary;
export function fromSplitPathInsideLibraryWithSeparatedSuffix<
	SK extends SplitPathKindType,
>(
	suffix: SuffixCodecs,
	sp: SplitPathInsideLibraryWithSeparatedSuffixOf<SK>,
): SplitPathInsideLibraryOf<SK> {
	const basename = suffix.serializeSeparatedSuffix(
		sp.separatedSuffixedBasename,
	);

	switch (sp.kind) {
		case SplitPathKind.Folder:
			{
				const folderPath = sp as SplitPathInsideLibraryWithSeparatedSuffixOf<
					typeof SplitPathKind.Folder
				>;
			return {
				basename,
				kind: SplitPathKind.Folder,
				pathParts: folderPath.pathParts,
			} as SplitPathInsideLibraryOf<SK>;
			}
		case SplitPathKind.File:
			{
				const filePath =
					sp as unknown as SplitPathInsideLibraryWithSeparatedSuffixOf<
						typeof SplitPathKind.File
					>;
			return {
				basename,
				extension: filePath.extension,
				kind: SplitPathKind.File,
				pathParts: filePath.pathParts,
			} as SplitPathInsideLibraryOf<SK>;
			}
		case SplitPathKind.MdFile:
			{
				const mdPath =
					sp as unknown as SplitPathInsideLibraryWithSeparatedSuffixOf<
						typeof SplitPathKind.MdFile
					>;
			return {
				basename,
				extension: mdPath.extension,
				kind: SplitPathKind.MdFile,
				pathParts: mdPath.pathParts,
			} as SplitPathInsideLibraryOf<SK>;
			}
	}
}
