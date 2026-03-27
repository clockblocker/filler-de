import type { VaultAction } from "@textfresser/vault-action-manager";
import type { CodecRules, Codecs } from "@textfresser/library-core/codecs";
import { healingActionsToVaultActions } from "@textfresser/library-core/codecs/healing-to-vault-action";
import { codexActionsToVaultActions } from "@textfresser/library-core/healer/library-tree/codex";
import type { CodexAction } from "@textfresser/library-core/healer/library-tree/codex/types/codex-action";
import type { HealingAction } from "@textfresser/library-core/healer/library-tree/types/healing-action";

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
