import { err, ok, type Result } from "neverthrow";
import {
	SplitPathKind,
	type SplitPathKind as SplitPathKindType,
} from "../../../../../managers/obsidian/vault-action-manager/types/split-path";
import { NodeNameSchema } from "../../../types/schemas/node-name";
import type { CodecError } from "../../errors";
import { makeSplitPathError, makeZodError } from "../../errors";
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
 * Converts split path inside library to split path with separated suffix.
 * Validates pathParts as NodeNames and parses basename.
 * Can be non-canonical (suffixParts may not match pathParts).
 */
export function splitPathInsideLibraryToWithSeparatedSuffix<
	SK extends SplitPathKindType,
>(
	suffix: SuffixCodecs,
	sp: SplitPathInsideLibraryOf<SK>,
): Result<SplitPathInsideLibraryWithSeparatedSuffixOf<SK>, CodecError>;
export function splitPathInsideLibraryToWithSeparatedSuffix(
	suffix: SuffixCodecs,
	sp: SplitPathToFolderInsideLibrary,
): Result<
	SplitPathInsideLibraryWithSeparatedSuffixOf<typeof SplitPathKind.Folder>,
	CodecError
>;
export function splitPathInsideLibraryToWithSeparatedSuffix(
	suffix: SuffixCodecs,
	sp: SplitPathToFileInsideLibrary,
): Result<
	SplitPathInsideLibraryWithSeparatedSuffixOf<typeof SplitPathKind.File>,
	CodecError
>;
export function splitPathInsideLibraryToWithSeparatedSuffix(
	suffix: SuffixCodecs,
	sp: SplitPathToMdFileInsideLibrary,
): Result<
	SplitPathInsideLibraryWithSeparatedSuffixOf<typeof SplitPathKind.MdFile>,
	CodecError
>;
export function splitPathInsideLibraryToWithSeparatedSuffix(
	suffix: SuffixCodecs,
	sp: AnySplitPathInsideLibrary,
): Result<AnySplitPathInsideLibraryWithSeparatedSuffix, CodecError> {
	// Validate path parts as NodeNames (split by delimiter validation)
	for (const p of sp.pathParts) {
		const r = NodeNameSchema.safeParse(p);
		if (!r.success) {
			return err(
				makeSplitPathError(
					"InvalidPathParts",
					r.error.issues[0]?.message ?? "Invalid path part",
					{ pathPart: p, pathParts: sp.pathParts },
					makeZodError(r.error.issues, "NodeName validation failed", {
						pathPart: p,
					}),
				),
			);
		}
	}

	// Parse basename into separated suffix (validates NodeNames via splitBySuffixDelimiter)
	const sepResult = suffix.parseSeparatedSuffix(sp.basename);
	if (sepResult.isErr()) {
		return err(
			makeSplitPathError(
				"InvalidBasename",
				sepResult.error.message,
				{ basename: sp.basename },
				sepResult.error,
			),
		);
	}

	switch (sp.kind) {
		case SplitPathKind.Folder:
			return ok({
				kind: SplitPathKind.Folder,
				pathParts: sp.pathParts,
				separatedSuffixedBasename: sepResult.value,
			});
		case SplitPathKind.File:
			return ok({
				extension: sp.extension,
				kind: SplitPathKind.File,
				pathParts: sp.pathParts,
				separatedSuffixedBasename: sepResult.value,
			});
		case SplitPathKind.MdFile:
			return ok({
				extension: sp.extension,
				kind: SplitPathKind.MdFile,
				pathParts: sp.pathParts,
				separatedSuffixedBasename: sepResult.value,
			});
	}
}
