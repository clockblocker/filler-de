import type { CodecRules, Codecs } from "@textfresser/library-core";
import {
	type CodexAction,
	codexActionsToVaultActions,
} from "@textfresser/library-core";
import {
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
 * @param rules - Codec rules
 * @param codecs - Codec API
 */
export function assembleVaultActions(
	healingActions: HealingAction[],
	codexActions: CodexAction[],
	rules: CodecRules,
	codecs: Codecs,
): VaultAction[] {
	return [
		...healingActionsToVaultActions(healingActions, rules),
		...codexActionsToVaultActions(codexActions, rules, codecs),
	];
}
