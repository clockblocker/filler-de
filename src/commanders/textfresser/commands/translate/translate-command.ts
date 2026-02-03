import { ok, type Result } from "neverthrow";
import type { VaultAction } from "../../../../managers/obsidian/vault-action-manager";
import type { CommandError, CommandInput, CommandState } from "../types";
import { logSelection } from "./steps/log-selection";

export function translateCommand(
	input: CommandInput<"TranslateSelection">,
): Result<VaultAction[], CommandError> {
	const state: CommandState<"TranslateSelection"> = { ...input, actions: [] };
	return logSelection(state).andThen((c) => ok(c.actions));
}
