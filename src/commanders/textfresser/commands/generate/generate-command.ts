/**
 * Generate command - moves files to sharded paths and sets noteKind: DictEntry.
 *
 * Pure function: receives context, returns Result<VaultAction[], Error>.
 * No VAM access - dispatching is handled by Textfresser.
 *
 * Pipeline: checkEligibility → applyMeta → moveToWorter → addWriteAction
 */

import { ok, type Result } from "neverthrow";
import type { VaultAction } from "../../../../managers/obsidian/vault-action-manager";
import { VaultActionKind } from "../../../../managers/obsidian/vault-action-manager/types/vault-action";

import type { CommandError, CommandInput, CommandState } from "../types";
import { applyMeta } from "./steps/apply-meta";
import { checkEligibility } from "./steps/check-eligibility";
import { moveToWorter } from "./steps/move-to-worter";

/**
 * Generate vault actions for the given file context.
 * Pure function - no VAM access, no side effects.
 *
 * @param input - File path, content, and state
 * @returns Result with array of VaultActions or CommandError
 */
export function generateCommand(
	input: CommandInput<"Generate">,
): Result<VaultAction[], CommandError> {
	const state: CommandState<"Generate"> = { ...input, actions: [] };

	return checkEligibility(state)
		.andThen(applyMeta)
		.andThen(moveToWorter)
		.andThen((c) => {
			const writeAction = {
				kind: VaultActionKind.ProcessMdFile,
				payload: {
					splitPath: c.currentFileInfo.path,
					transform: () => c.currentFileInfo.content,
				},
			} as const;
			return ok([...c.actions, writeAction]);
		});
}
