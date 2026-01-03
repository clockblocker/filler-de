import type { RenameTreeNodeNodeMaterializedEvent } from "../../../../bulk-vault-action-adapter/layers/materialized-node-events/types";
import { ChangePolicy } from "./types";

/**
 * Infers canonicalization policy for a Rename (rename/move) event.
 *
 * Policy meaning:
 * - NameKing: basename is authoritative; suffix chain defines section hierarchy.
 * - PathKing: folder path is authoritative; basename suffix is ignored.
 *
 * Rule:
 * - If basename changed → NameKing.
 * - If basename did NOT change → PathKing.
 *
 * ───────────────
 * Folder examples
 * ───────────────
 *
 * NameKing:
 *   Library/pie → Library/sweet-pie
 *
 *   Canonicalization:
 *   - Sections derived from basename suffix:
 *     "sweet-pie" → ["sweet"]
 *
 * PathKing:
 *   Library/pie → Library/recipe/pie
 *
 *   Canonicalization:
 *   - Sections derived from folder path:
 *     ["recipe"]
 *
 * ──────────────
 * File examples
 * ──────────────
 *
 * NameKing:
 *   Library/pie.md → Library/sweet-pie.md
 *
 *   Canonicalization:
 *   - Sections derived from basename suffix:
 *     "sweet-pie" → ["sweet"]
 *
 * PathKing:
 *   Library/pie.md → Library/recipe/pie.md
 *
 *   Canonicalization:
 *   - Sections derived from folder path:
 *     ["recipe"]
 *
 * Note:
 * This policy controls **canonical split-path construction only**.
 * It does not decide whether the action is a Rename or Move — that is handled
 * separately by `inferRenameIntent`.
 */
export function inferMovePolicy({
	to,
	from,
}: RenameTreeNodeNodeMaterializedEvent): ChangePolicy {
	const basenameChanged = from.basename !== to.basename;

	if (basenameChanged) return ChangePolicy.NameKing;

	return ChangePolicy.PathKing;
}
