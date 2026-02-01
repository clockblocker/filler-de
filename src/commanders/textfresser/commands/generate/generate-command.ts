import { ok, type Result } from "neverthrow";
import type { VaultAction } from "../../../../managers/obsidian/vault-action-manager";
import { VaultActionKind } from "../../../../managers/obsidian/vault-action-manager/types/vault-action";

import type { CommandError, CommandInput, CommandState } from "../types";
import { applyMeta } from "./steps/apply-meta";
import { checkEligibility } from "./steps/check-eligibility";
import { moveToWorter } from "./steps/move-to-worter";

/** Pipeline: checkEligibility → applyMeta → moveToWorter → addWriteAction */
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
