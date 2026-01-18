import { err, ok, type Result } from "neverthrow";
import type { SplitPathKind } from "../../../../../../managers/obsidian/vault-action-manager/types/split-path";
import type { SuffixCodecs } from "../../../internal/suffix";
import type { SplitPathInsideLibraryOf } from "../../../split-path-inside-library";
import { NodeNameSchema } from "../../../types/schemas/node-name";
import type { CodecError } from "../../errors";
import { makeSplitPathError, makeZodError } from "../../errors";
import type { SplitPathInsideLibraryWithSeparatedSuffixOf } from "../types";

/**
 * Converts split path inside library to split path with separated suffix.
 * Validates pathParts as NodeNames and parses basename.
 * Can be non-canonical (suffixParts may not match pathParts).
 */
export function splitPathInsideLibraryToWithSeparatedSuffix<
	SK extends SplitPathKind,
>(
	suffix: SuffixCodecs,
	sp: SplitPathInsideLibraryOf<SK>,
): Result<SplitPathInsideLibraryWithSeparatedSuffixOf<SK>, CodecError> {
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

	return ok({
		...sp,
		separatedSuffixedBasename: sepResult.value,
	} as unknown as SplitPathInsideLibraryWithSeparatedSuffixOf<SK>);
}
