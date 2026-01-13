import { err, ok, type Result } from "neverthrow";
import { SplitPathKind } from "../../../../../../../managers/obsidian/vault-action-manager/types/split-path";
import type { CodecError } from "../../../../../codecs/errors";
import { makeSplitPathError } from "../../../../../codecs/errors";
import type { SuffixCodecs } from "../../../../../codecs/internal/suffix";
import type { SeparatedSuffixedBasename } from "../../../../../codecs/internal/suffix/types";
import type { AnySplitPathInsideLibrary } from "../../../../../codecs/split-path-inside-library";
import type {
	CanonicalSeparatedSuffixedBasename,
	SplitPathInsideLibraryWithSeparatedSuffixOf,
} from "../../../../../codecs/split-path-with-separated-suffix";

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
 * Builds canonical separated suffixed basename from pathParts and coreName.
 * Canonization policy: suffixParts derived from pathParts (reversed, sans root).
 * Folders have empty suffixParts.
 */
export function buildCanonicalSeparatedSuffixedBasename(
	suffix: SuffixCodecs,
	libraryRootName: string,
	coreName: string,
	sp: Pick<AnySplitPathInsideLibrary, "pathParts" | "kind">,
): CanonicalSeparatedSuffixedBasename {
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
}

/**
 * Validates that separated suffix matches canonical format.
 * Policy enforcement: actual suffixParts must match expected (from pathParts).
 * Folders must have empty suffixParts.
 */
export function validateCanonicalFormat<SK extends SplitPathKind>(
	actual: SeparatedSuffixedBasename,
	expected: SeparatedSuffixedBasename,
	kind: SK,
): Result<void, CodecError> {
	// Verify actual matches expected
	const same =
		actual.coreName === expected.coreName &&
		actual.suffixParts.length === expected.suffixParts.length &&
		actual.suffixParts.every((v, i) => v === expected.suffixParts[i]);

	if (!same) {
		return err(
			makeSplitPathError(
				"CanonicalizationFailed",
				"Basename does not match canonical format",
				{
					actual: {
						coreName: actual.coreName,
						suffixParts: actual.suffixParts,
					},
					expected: {
						coreName: expected.coreName,
						suffixParts: expected.suffixParts,
					},
				},
			),
		);
	}

	// Additionally enforce folder has no suffixParts (redundant but explicit)
	if (kind === SplitPathKind.Folder && actual.suffixParts.length !== 0) {
		return err(
			makeSplitPathError(
				"CanonicalizationFailed",
				"Folder basename must not contain suffix parts",
				{ suffixParts: actual.suffixParts },
			),
		);
	}

	return ok(undefined);
}

/**
 * Canonizes split path with separated suffix.
 * Uses pathParts to build expected canonical format and validates against actual.
 */
export function canonizeSplitPathWithSeparatedSuffix<SK extends SplitPathKind>(
	suffix: SuffixCodecs,
	libraryRootName: string,
	sp: SplitPathInsideLibraryWithSeparatedSuffixOf<SK>,
): Result<SplitPathInsideLibraryWithSeparatedSuffixOf<SK>, CodecError> {
	const expected = buildCanonicalSeparatedSuffixedBasename(
		suffix,
		libraryRootName,
		sp.separatedSuffixedBasename.coreName,
		sp,
	);

	const validationResult = validateCanonicalFormat(
		sp.separatedSuffixedBasename,
		expected.separatedSuffixedBasename,
		sp.kind,
	);
	if (validationResult.isErr()) {
		return err(validationResult.error);
	}

	return ok(sp);
}
