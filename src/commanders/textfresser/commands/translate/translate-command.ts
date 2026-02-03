import { ok, ResultAsync } from "neverthrow";
import type { VaultAction } from "../../../../managers/obsidian/vault-action-manager";
import type { CommandError, CommandInput, CommandState } from "../types";
import { logSelection } from "./steps/log-selection";

export function translateCommand(
	input: CommandInput,
): ResultAsync<VaultAction[], CommandError> {
	const state: CommandState = { ...input, actions: [] };
	return new ResultAsync(
		Promise.resolve(logSelection(state).andThen((c) => ok(c.actions))),
	);
}
