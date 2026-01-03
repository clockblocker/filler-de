import type { RenameTreeNodeNodeMaterializedEvent } from "../../../../bulk-vault-action-adapter/layers/materialized-node-events/types";
import { tryMakeSeparatedSuffixedBasename } from "../../../../utils/suffix-utils/suffix-utils";
import { RenameIntent } from "./types";

/**
 * Infers semantic intent of a Rename event.
 *
 * Rule:
 * - If basename did NOT change → MOVE (path-based move).
 * - If basename changed:
 *   - no suffix parts → RENAME (pure rename).
 *   - has suffix parts → MOVE ("move-by-name").
 *
 * ───────────────
 * Folder examples
 * ───────────────
 *
 * RENAME intent:
 *   Library/pie → Library/pies
 *
 *   Expected heals:
 *   - Folder renamed: pie → pies
 *   - Children suffixes updated:
 *     Library/pie/XXX-pie.md → Library/pies/XXX-pies.md
 *
 * MOVE intent:
 *   Library/pie → Library/sweet-pie
 *
 *   Expected heals:
 *   - Folder moved under `sweet/`:
 *     Library/sweet-pie → Library/sweet/pie
 *   - Children moved + suffixes updated:
 *     Library/pie/XXX-pie.md → Library/sweet/pie/XXX-sweet-pie.md
 *
 * ──────────────
 * File examples
 * ──────────────
 *
 * RENAME intent:
 *   Library/pie.md → Library/pies.md
 *
 *   Expected heals:
 *   - File renamed in place:
 *     Library/pie.md → Library/pies.md
 *
 * MOVE intent:
 *   Library/pie.md → Library/sweet-pie.md
 *
 *   Expected heals:
 *   - File moved under `sweet/`:
 *     Library/sweet-pie.md → Library/sweet/sweet-pie.md
 *
 * Note:
 * This function only infers **intent**.
 * All actual filesystem changes are produced later by Tree healing logic.
 */
export function inferRenameIntent({
	to,
	from,
}: RenameTreeNodeNodeMaterializedEvent): RenameIntent {
	const basenameChanged = from.basename !== to.basename;

	// path move (basename unchanged)
	if (!basenameChanged) return RenameIntent.Move;

	// basename changed: "move-by-name" iff suffix chain exists
	const sepRes = tryMakeSeparatedSuffixedBasename(to);

	// if invalid basename, treat as plain rename (will be rejected/healed later anyway)
	if (sepRes.isErr()) return RenameIntent.Rename;

	return sepRes.value.suffixParts.length > 0
		? RenameIntent.Move
		: RenameIntent.Rename;
}
