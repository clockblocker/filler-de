import { ok, ResultAsync } from "neverthrow";
import type { VaultAction } from "../../../../managers/obsidian/vault-action-manager";
import { VaultActionKind } from "../../../../managers/obsidian/vault-action-manager/types/vault-action";

import type { CommandError, CommandInput, CommandState } from "../types";
import { applyMeta } from "./steps/apply-meta";
import { checkAttestation } from "./steps/check-attestation";
import { checkEligibility } from "./steps/check-eligibility";
import { moveToWorter } from "./steps/move-to-worter";

/** Pipeline: checkAttestation → checkEligibility → applyMeta → moveToWorter → addWriteAction */
export function generateCommand(
	input: CommandInput,
): ResultAsync<VaultAction[], CommandError> {
	const state: CommandState = { ...input, actions: [] };

	return new ResultAsync(
		Promise.resolve(
			checkAttestation(state)
				.andThen(checkEligibility)
				.andThen(applyMeta)
				.andThen(moveToWorter)
				.andThen((c) => {
					const activeFile = c.commandContext.activeFile;
					const writeAction = {
						kind: VaultActionKind.ProcessMdFile,
						payload: {
							splitPath: activeFile.splitPath,
							transform: () => activeFile.content,
						},
					} as const;
					return ok([...c.actions, writeAction]);
				}),
		),
	);
}
