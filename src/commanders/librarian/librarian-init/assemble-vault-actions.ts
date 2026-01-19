import type { VaultAction } from "../../../managers/obsidian/vault-action-manager";
import type { CodecRules, Codecs } from "../codecs";
import { healingActionsToVaultActions } from "../codecs/healing-to-vault-action";
import { codexActionsToVaultActions } from "../healer/library-tree/codex";
import type { CodexAction } from "../healer/library-tree/codex/types/codex-action";
import type { HealingAction } from "../healer/library-tree/types/healing-action";

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
