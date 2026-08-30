import type { Codecs } from "../../../../../../../../codecs";
import { TreeNodeKind } from "../../../../../../tree-node/types/atoms";
import type { RenameTreeNodeNodeMaterializedEvent } from "../../../materialized-node-events/types";
import { RenameIntent } from "./types";

/**
 * Infers semantic intent of a Rename event.
 *
 * Rule:
 * - If basename did NOT change → MOVE (path-based move).
 * - If basename changed:
 *   - For FOLDERS:
 *     - no suffix → RENAME (folders don't have suffixe canonically)
 *     - has suffix → MOVE (folder should be moved based on suffix)
 *   - For FILES:
 *     - no suffix → RENAME; the containing Section remains authoritative
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
 *
 *   Expected heals:
 *   - File moved based on suffix
 *
 * Note:
 * This function only infers **intent**.
 * All actual filesystem changes are produced later by Tree healing logic.
 */
export function inferRenameIntent(
	{ to, from, nodeKind }: RenameTreeNodeNodeMaterializedEvent,
	codecs: Codecs,
): RenameIntent {
	const basenameChanged = from.basename !== to.basename;
	const isFolder = nodeKind === TreeNodeKind.Section;

	// path move (basename unchanged)
	if (!basenameChanged) return RenameIntent.Move;

	// basename changed: check if it's a "move-by-name" or just a rename
	const sepRes = codecs.suffix
		.parseSeparatedSuffix(to.basename)
		.mapErr((error) => error.message);

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
	const currentSuffixParts = codecs.suffix.pathPartsWithRootToSuffixParts(
		to.pathParts,
	);

	// An unsuffixed basename change is a Core Name rename. The observed folder
	// remains authoritative and Healing restores its Library Suffix.
	if (newSuffixParts.length === 0) {
		return RenameIntent.Rename;
	}

	// If suffix matches path, user just renamed the coreName — not a move
	const suffixMatchesPath =
		newSuffixParts.length === currentSuffixParts.length &&
		newSuffixParts.every((s, i) => s === currentSuffixParts[i]);

	return suffixMatchesPath ? RenameIntent.Rename : RenameIntent.Move;
}
