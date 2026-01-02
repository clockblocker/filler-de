import type { RenameTreeNodeNodeMaterializedEvent } from "../../../bulk-vault-action-adapter/layers/materialized-node-events/types";
import { ChangePolicy } from "./types";

/**
 * Infers the canonicalization policy for a Rename (rename/move) event.
 *
 * Rules:
 * - `PathKing`: used when the **folder path changes**.
 *   The new folder hierarchy defines the canonical section chain.
 * - `NameKing`: used when the **basename changes in place**.
 *   The basename suffix defines the canonical section chain.
 *
 * Mixed changes (path + name) are treated as `PathKing`
 * to avoid accidental section reshaping from filename edits.
 *
 * @example
 * // Move without rename
 * // Library/Parent/Note.md → Library/Parent/Child/Note.md
 * inferMovePolicy(...)
 * // => "PathKing"
 *
 * @example
 * // Rename in place
 * // Library/Parent/Note-Child.md → Library/Parent/Note-Sweet-Child.md
 * inferMovePolicy(...)
 * // => "NameKing"
 */
export function inferMovePolicy({
	libraryScopedTo,
	libraryScopedFrom,
}: RenameTreeNodeNodeMaterializedEvent): ChangePolicy {
	const basenameChanged =
		libraryScopedFrom.basename !== libraryScopedTo.basename;

	if (basenameChanged) return ChangePolicy.NameKing;

	return ChangePolicy.PathKing;
}
