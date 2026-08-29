import type { Codecs } from "@textfresser/library-core";
import {
	type CodexAction,
	codexActionsToVaultActions,
	type HealingAction,
	healingActionsToVaultActions,
} from "@textfresser/library-core";
import type { VaultAction } from "@textfresser/vault-action-manager";

/**
 * Combine healing actions and codex actions into vault actions.
 * Pure function for assembling all vault operations.
 *
 * @param healingActions - Array of healing actions
 * @param codexActions - Array of codex actions
 * @param codecs - Codec API
 */
export function assembleVaultActions(
	healingActions: HealingAction[],
	codexActions: CodexAction[],
	codecs: Codecs,
): VaultAction[] {
	return [
		...healingActionsToVaultActions(healingActions, codecs),
		...codexActionsToVaultActions(codexActions, codecs),
	];
}
