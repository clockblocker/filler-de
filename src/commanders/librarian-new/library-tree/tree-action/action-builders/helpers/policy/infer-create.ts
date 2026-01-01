import type { CreateLeafNodeMaterializedEvent } from "../../../bulk-vault-action-adapter/layers/materialized-node-events/types";
import { ChangePolicy } from "./types";

/**
 * Infers the canonicalization policy for a Create (import) event.
 *
 * Rules:
 * - `NameKing`: used for files created directly under `Library/`
 *   The basename suffix defines section hierarchy.
 * - `PathKing`: used for files created in nested folders under `Library/`.
 *   The folder path defines section hierarchy; basename suffix is ignored.
 *
 * @example
 * // Library/MyNote-Child-Parent.md
 * inferCreatePolicy({ pathParts: [], ... })
 * // => "NameKing"
 *
 * @example
 * // Library/Parent/Child/MyNote.md
 * inferCreatePolicy({ pathParts: ["Parent", "Child"], ... })
 * // => "PathKing"
 */
export function inferCreatePolicy({
	libraryScopedSplitPath,
}: CreateLeafNodeMaterializedEvent): ChangePolicy {
	// direct child of "Library/" => NameKing
	// nested under "Library/..." => PathKing
	return libraryScopedSplitPath.pathParts.length === 0
		? ChangePolicy.NameKing
		: ChangePolicy.PathKing;
}
