import {
	makeSuffixPartsFromPathPartsWithRoot,
	tryMakeSeparatedSuffixedBasename,
} from "../../../../../utils/canonical-naming/suffix-utils/core-suffix-utils";
import type { RenameTreeNodeNodeMaterializedEvent } from "../../../materialized-node-events/types";
import { RenameIntent } from "./types";

/**
 * Infers semantic intent of a Rename event.
 *
 * Rule:
 * - If basename did NOT change → MOVE (path-based move).
 * - If basename changed:
 *   - no suffix parts → RENAME (pure rename).
 *   - suffix matches current path → RENAME (user just changed coreName).
 *   - suffix differs from current path → MOVE ("move-by-name").
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
 *   Library/Test/Untitled-Test.md → Library/Test/123-Test.md
 *
 *   Expected heals:
 *   - File renamed in place (suffix matches path):
 *     Library/Test/123-Test.md stays as is
 *
 * MOVE intent:
 *   Library/pie.md → Library/sweet-pie.md
 *
 *   Expected heals:
 *   - File moved under `sweet/`:
 *     Library/sweet-pie.md → Library/sweet/pie-sweet.md
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

	// basename changed: check if it's a "move-by-name" or just a rename
	const sepRes = tryMakeSeparatedSuffixedBasename(to);

	// if invalid basename, treat as plain rename (will be rejected/healed later anyway)
	if (sepRes.isErr()) return RenameIntent.Rename;

	const newSuffixParts = sepRes.value.suffixParts;

	// no suffix → pure rename
	if (newSuffixParts.length === 0) return RenameIntent.Rename;

	// Compare new suffix with current path (sans Library root)
	// If they match, user just renamed the coreName — not a move
	const currentSuffixParts = makeSuffixPartsFromPathPartsWithRoot(
		to.pathParts,
	);

	const suffixMatchesPath =
		newSuffixParts.length === currentSuffixParts.length &&
		newSuffixParts.every((s, i) => s === currentSuffixParts[i]);

	return suffixMatchesPath ? RenameIntent.Rename : RenameIntent.Move;
}
