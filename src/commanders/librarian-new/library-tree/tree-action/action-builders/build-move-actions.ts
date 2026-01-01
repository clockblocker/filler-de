import type {
	RenameFileNodeMaterializedEvent,
	RenameScrollNodeMaterializedEvent,
	RenameSectionNodeMaterializedEvent,
} from "../bulk-vault-action-adapter/layers/materialized-node-events/types";
import type { MoveNodeAction } from "../types/tree-action";

/**
 * Translates a materialized Rename event (inside→inside root) into a semantic MoveNodeAction[]
 * when the rename-to encodes a delimiter (i.e. user intent = MOVE).
 *
 * Move-intent encoding:
 * - Leaf (File|Scroll):
 *   - `to.basename = LEAF{d}PARENT{d}GRAND_PARENT...`
 *   - `newName = LEAF`
 *   - `newParent.sectionNames = reverse([PARENT, GRAND_PARENT, ...])`
 *
 * - Section (Folder):
 *   - `to.basename = PARENT{d}...{d}NEW_NAME`
 *   - `newName = NEW_NAME` (last token)
 *   - `newParent.sectionNames = [PARENT, ...]` (tokens without last)
 *
 * Target resolution (current contract):
 * - `target` is resolved from `ev.libraryScopedFrom` assuming it is canonical.
 *   (Later: identity recovery if `from` is non-canonical.)
 *
 * Healing support:
 * - `observedVaultSplitPath` is always `ev.libraryScopedTo` (post-user-operation),
 *   and may be non-canonical. Used later to emit `VaultAction.rename(fromObserved, toCanonical)`.
 *
 * If the rename-to does NOT contain the suffix delimiter, this function returns `[]`
 * (it is a pure MOVE translator; RENAME is handled elsewhere).
 *
 * @example
 * // Leaf move via basename
 * // Observed: Library/pie/pie.md -> Library/pie/pie-sweet.md
 * // to.basename = "pie-sweet" => suffixParts=["sweet"] => newParent=["sweet"], newName="pie"
 * // => MoveScrollNodeAction(target=locator(pie@pie), newParent=locator(sweet), newName="pie",
 * //    observedVaultSplitPath=to)
 *
 * @example
 * // Leaf move via folder path (still MOVE; basename will be healed later)
 * // Observed: Library/pie/pie.md -> Library/pie/sweet/pie.md
 * // to.basename = "pie" (no delimiter) => NOT handled here (rename/move classification elsewhere)
 *
 * @example
 * // Section move
 * // Observed: Library/pie -> Library/sweet-pie
 * // to.basename="sweet-pie" => newParent=["sweet"], newName="pie"
 * // => MoveSectionNodeAction(... observedVaultSplitPath=to)
 */
export function traslateMoveMaterializedEvent(
	ev:
		| RenameFileNodeMaterializedEvent
		| RenameScrollNodeMaterializedEvent
		| RenameSectionNodeMaterializedEvent,
): MoveNodeAction[];
