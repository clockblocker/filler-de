import type { BulkVaultEvent } from "../../../../../../managers/obsidian/vault-action-manager";
import type { CodecRules, Codecs } from "../../../../codecs";
import type { TreeAction } from "../types/tree-action";
import { makeLibraryScopedBulkVaultEvent } from "./layers/library-scope/codecs/make-library-scoped-bulk";
import { materializeScopedBulk } from "./layers/materialized-node-events/materialize-scoped-bulk";
import { translateMaterializedEvents } from "./layers/translate-material-event/translate-material-events";

/**
 * The **semantic boundary** between raw vault events and tree-level mutation logic.
 *
 * Translates raw user-triggered VaultEvents into ready-for-healing
 * semantic Tree actions based on inferred user intent.
 *
 * Notes:
 * - Files or folders entering the Library from outside (including initial vault load)
 *   are registered as `Create` actions.
 *
 * @example
 * // Rename intent (no suffix semantics)
 * // Library/pie → Library/pies
 * //
 * // → RenameNodeAction
 * //   target: pie
 * //   newNodeName: pies
 *
 * @example
 * // Move intent via name (suffix-driven)
 * // Library/pie → Library/sweet-pie
 * //
 * // → MoveNodeAction
 * //   target: pie
 * //   newParent: sweet
 * //   newNodeName: pie
 *
 * @example
 * // Path-based move
 * // Library/pie → Library/recipe/pie
 * //
 * // → MoveNodeAction
 * //   target: pie
 * //   newParent: recipe
 * //   newNodeName: pie
 */
export const buildTreeActions = (
	bulk: BulkVaultEvent,
	codecs: Codecs,
	rules: CodecRules,
): TreeAction[] => {
	return translateMaterializedEvents(
		materializeScopedBulk(makeLibraryScopedBulkVaultEvent(bulk, rules)),
		codecs,
	);
};
