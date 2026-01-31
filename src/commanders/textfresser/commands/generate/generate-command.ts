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
import type { CommandError, CommandPayload } from "../types";
import { applyMeta } from "./steps/apply-meta";
import { checkEligibility } from "./steps/check-eligibility";
import { moveToWorter } from "./steps/move-to-worter";

// ─── Command ───

/**
 * Generate vault actions for the given file context.
 * Pure function - no VAM access, no side effects.
 *
 * @param ctx - File path and content
 * @returns Result with array of VaultActions or CommandError
 */
export function generateCommand(
	payload: CommandPayload,
): Result<VaultAction[], CommandError> {
	// Execute pipeline: checkEligibility → applyMeta → moveToWorter → addWriteAction
	return checkEligibility(payload)
		.andThen(applyMeta)
		.andThen(moveToWorter)
		.andThen((c) => {
			const writeAction = {
				kind: VaultActionKind.ProcessMdFile,
				payload: {
					splitPath: c.splitPath,
					transform: () => c.content,
				},
			} as const;
			return ok([...c.actions, writeAction]);
		});
}
