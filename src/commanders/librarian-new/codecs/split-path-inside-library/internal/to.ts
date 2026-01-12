import { err, ok, type Result } from "neverthrow";
import type { AnySplitPath } from "../../../../../managers/obsidian/vault-action-manager/types/split-path";
import { NodeNameSchema } from "../../../types/schemas/node-name";
import type { CodecError } from "../../errors";
import { makeSplitPathError, makeZodError } from "../../errors";
import type { CodecRules } from "../../rules";
import type { SplitPathInsideLibrary } from "../../tree-action/bulk-vault-action-adapter/layers/library-scope/types/inside-library-split-paths";

/**
 * Converts vault-scoped split path to library-scoped split path.
 * Chops off LibraryRoot path parts.
 * Returns proper CodecError with reason if not inside library.
 */
export function toInsideLibrary(
	rules: CodecRules,
	sp: AnySplitPath,
): Result<SplitPathInsideLibrary, CodecError> {
	const { pathParts } = sp;
	const libraryRootName = rules.libraryRootName;

	// Empty pathParts is allowed only for Library root folder
	if (pathParts.length === 0) {
		return ok(sp as SplitPathInsideLibrary);
	}

	// Non-empty pathParts must start with Library root
	if (pathParts[0] !== libraryRootName) {
		return err(
			makeSplitPathError(
				"OutsideLibrary",
				`Path does not start with library root: ${libraryRootName}`,
				{
					firstPart: pathParts[0],
					libraryRootName,
					pathParts,
				},
			),
		);
	}

	// Validate all path parts as NodeNames
	for (const p of pathParts) {
		const r = NodeNameSchema.safeParse(p);
		if (!r.success) {
			return err(
				makeSplitPathError(
					"InvalidPathParts",
					r.error.issues[0]?.message ?? "Invalid path part",
					{ pathPart: p, pathParts },
					makeZodError(r.error.issues, "NodeName validation failed", {
						pathPart: p,
					}),
				),
			);
		}
	}

	// Path is inside library, return as-is (already has correct type)
	return ok(sp as SplitPathInsideLibrary);
}
