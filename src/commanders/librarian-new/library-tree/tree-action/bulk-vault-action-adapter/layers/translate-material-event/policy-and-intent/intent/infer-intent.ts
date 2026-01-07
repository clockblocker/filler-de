import { TreeNodeType } from "../../../../../../tree-node/types/atoms";
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
 *   - For FOLDERS:
 *     - no suffix → RENAME (folders don't have suffixes normally)
 *     - has suffix → MOVE (folder should be moved based on suffix)
 *   - For FILES:
 *     - no suffix AND at root → RENAME
 *     - no suffix AND nested → MOVE to root (NameKing: empty suffix = root)
 *     - suffix matches current path → RENAME (user just changed coreName)
 *     - suffix differs from current path → MOVE ("move-by-name")
 *
 * ───────────────
 * Folder examples
 * ───────────────
 *
 * RENAME intent:
 *   Library/pie → Library/pies
 *   Library/grandpa/father/kid → Library/grandpa/father/son
 *
 *   Expected heals:
 *   - Folder renamed in place
 *   - Children suffixes updated accordingly
 *
 * MOVE intent:
 *   Library/pie → Library/sweet-pie
 *
 *   Expected heals:
 *   - Folder moved under `sweet/`:
 *     Library/sweet-pie → Library/sweet/pie
 *   - Children moved + suffixes updated
 *
 * ──────────────
 * File examples
 * ──────────────
 *
 * RENAME intent:
 *   Library/Test/Untitled-Test.md → Library/Test/123-Test.md
 *
 *   Expected heals:
 *   - File renamed in place (suffix matches path)
 *
 * MOVE intent:
 *   Library/pie.md → Library/sweet-pie.md
 *   Library/A/B/Note-B-A.md → Library/A/B/Note.md (move to root)
 *
 *   Expected heals:
 *   - File moved based on suffix (or to root if no suffix)
 *
 * Note:
 * This function only infers **intent**.
 * All actual filesystem changes are produced later by Tree healing logic.
 */
export function inferRenameIntent({
	to,
	from,
	nodeType,
}: RenameTreeNodeNodeMaterializedEvent): RenameIntent {
	const basenameChanged = from.basename !== to.basename;
	const isFolder = nodeType === TreeNodeType.Section;

	// path move (basename unchanged)
	if (!basenameChanged) return RenameIntent.Move;

	// basename changed: check if it's a "move-by-name" or just a rename
	const sepRes = tryMakeSeparatedSuffixedBasename(to);

	// if invalid basename, treat as plain rename (will be rejected/healed later anyway)
	if (sepRes.isErr()) return RenameIntent.Rename;

	const newSuffixParts = sepRes.value.suffixParts;

	// FOLDERS: no suffix in basename is normal (folders don't have suffixes)
	// Only Move if user explicitly added a suffix to the folder name
	if (isFolder) {
		return newSuffixParts.length === 0
			? RenameIntent.Rename
			: RenameIntent.Move;
	}

	// FILES: compare suffix with current path
	const currentSuffixParts = makeSuffixPartsFromPathPartsWithRoot(
		to.pathParts,
	);

	// no suffix AND already at root → pure rename
	// no suffix AND NOT at root → move to root (NameKing: empty suffix = root)
	if (newSuffixParts.length === 0) {
		return currentSuffixParts.length === 0
			? RenameIntent.Rename
			: RenameIntent.Move;
	}

	// If suffix matches path, user just renamed the coreName — not a move
	const suffixMatchesPath =
		newSuffixParts.length === currentSuffixParts.length &&
		newSuffixParts.every((s, i) => s === currentSuffixParts[i]);

	return suffixMatchesPath ? RenameIntent.Rename : RenameIntent.Move;
}
