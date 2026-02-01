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
import { logger } from "../../../../utils/logger";
import type { CommandError, CommandInput, CommandPayload } from "../types";
import { applyMeta } from "./steps/apply-meta";
import { checkEligibility } from "./steps/check-eligibility";
import { moveToWorter } from "./steps/move-to-worter";

// ─── Command ───

/**
 * Generate vault actions for the given file context.
 * Pure function - no VAM access, no side effects.
 *
 * @param input - File path, content, and state
 * @returns Result with array of VaultActions or CommandError
 */
export function generateCommand(
	input: CommandInput,
): Result<VaultAction[], CommandError> {
	const payload: CommandPayload = { ...input, actions: [] };
	logger.info("[generateCommand] payload:", payload);
	// Execute pipeline: checkEligibility → applyMeta → moveToWorter → addWriteAction
	return checkEligibility(payload)
		.andThen(applyMeta)
		.andThen(moveToWorter)
		.andThen((c) => {
			const writeAction = {
				kind: VaultActionKind.ProcessMdFile,
				payload: {
					splitPath: c.pathOfCurrentFile,
					transform: () => c.content,
				},
			} as const;
			return ok([...c.actions, writeAction]);
		});
}
