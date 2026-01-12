import { err, ok, type Result } from "neverthrow";
import { SplitPathKind } from "../../../../../managers/obsidian/vault-action-manager/types/split-path";
import type { NodeName } from "../../../types/schemas/node-name";
import { NodeNameSchema } from "../../../types/schemas/node-name";
import type { CodecError } from "../../errors";
import { makeSplitPathError, makeZodError } from "../../errors";
import type { SuffixCodecs } from "../../internal/suffix";
import type { SplitPathInsideLibrary } from "../../tree-action/bulk-vault-action-adapter/layers/library-scope/types/inside-library-split-paths";
import type {
	CanonicalSeparatedSuffixedBasename,
	CanonicalSplitPathInsideLibrary,
} from "../../tree-action/utils/canonical-naming/types";

/**
 * Extracts duplicate marker (e.g., " 1", " 2") from end of basename.
 * Obsidian appends " N" when duplicating files.
 */
function extractDuplicateMarker(basename: string): {
	cleanBasename: string;
	marker: string;
} {
	const match = basename.match(/^(.+?)( \d+)$/);
	if (match) {
		return { cleanBasename: match[1] ?? basename, marker: match[2] ?? "" };
	}
	return { cleanBasename: basename, marker: "" };
}

/**
 * Drops Library root from pathParts if present.
 */
function dropLibraryRootIfPresent(
	libraryRootName: string,
	pathParts: string[],
): string[] {
	return pathParts[0] === libraryRootName ? pathParts.slice(1) : pathParts;
}

/**
 * Builds canonical separated suffixed basename from split path.
 */
function buildCanonicalSeparatedSuffixedBasename(
	suffix: SuffixCodecs,
	libraryRootName: string,
	sp: Pick<SplitPathInsideLibrary, "basename" | "pathParts" | "kind">,
): Result<CanonicalSeparatedSuffixedBasename, CodecError> {
	// Handle Obsidian duplicate marker (e.g., "Note-A 1" → coreName="Note 1", suffix=["A"])
	const { cleanBasename, marker } = extractDuplicateMarker(sp.basename);

	return suffix.splitBySuffixDelimiter(cleanBasename).map((parts) => {
		const [rawCoreName, ..._suffixFromName] = parts;
		// Re-attach duplicate marker to coreName
		const coreName = (rawCoreName + marker) as typeof rawCoreName;

		const pathPartsSansRoot = dropLibraryRootIfPresent(
			libraryRootName,
			sp.pathParts,
		);
		const suffixParts =
			sp.kind === SplitPathKind.Folder
				? []
				: suffix.pathPartsToSuffixParts(pathPartsSansRoot);

		return {
			separatedSuffixedBasename: { coreName, suffixParts },
		};
	});
}

/**
 * Converts split path inside library to canonical format.
 * Validates and separates suffix.
 */
export function splitPathInsideLibraryToCanonical(
	suffix: SuffixCodecs,
	libraryRootName: string,
	sp: SplitPathInsideLibrary,
): Result<CanonicalSplitPathInsideLibrary, CodecError> {
	// Validate path parts as NodeNames
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

	// Parse actual separated suffix from basename
	const actualSepResult = suffix.parseSeparatedSuffix(sp.basename);
	if (actualSepResult.isErr()) {
		return err(
			makeSplitPathError(
				"InvalidBasename",
				actualSepResult.error.message,
				{ basename: sp.basename },
				actualSepResult.error,
			),
		);
	}

	// Build expected canonical separated suffix
	const canonicalResult = buildCanonicalSeparatedSuffixedBasename(
		suffix,
		libraryRootName,
		sp,
	);
	if (canonicalResult.isErr()) {
		return err(
			makeSplitPathError(
				"CanonicalizationFailed",
				canonicalResult.error.message,
				{ basename: sp.basename, pathParts: sp.pathParts },
				canonicalResult.error,
			),
		);
	}

	const { coreName, suffixParts } = actualSepResult.value;
	const expected = canonicalResult.value.separatedSuffixedBasename;

	// Verify actual matches expected
	const same =
		coreName === expected.coreName &&
		suffixParts.length === expected.suffixParts.length &&
		suffixParts.every((v, i) => v === expected.suffixParts[i]);

	if (!same) {
		return err(
			makeSplitPathError(
				"CanonicalizationFailed",
				"Basename does not match canonical format",
				{
					actual: { coreName, suffixParts },
					expected: {
						coreName: expected.coreName,
						suffixParts: expected.suffixParts,
					},
				},
			),
		);
	}

	// Additionally enforce folder has no suffixParts (redundant but explicit)
	if (sp.kind === SplitPathKind.Folder && suffixParts.length !== 0) {
		return err(
			makeSplitPathError(
				"CanonicalizationFailed",
				"Folder basename must not contain suffix parts",
				{ suffixParts },
			),
		);
	}

	return ok({
		...sp,
		separatedSuffixedBasename: actualSepResult.value,
	} as CanonicalSplitPathInsideLibrary);
}
