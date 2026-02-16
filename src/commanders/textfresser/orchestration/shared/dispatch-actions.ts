import { err, ok, ResultAsync } from "neverthrow";
import type {
	VaultAction,
	VaultActionManager,
} from "../../../../managers/obsidian/vault-action-manager";
import type { CommandError } from "../../commands/types";
import { CommandErrorKind } from "../../errors";

export function dispatchActions(
	vam: VaultActionManager,
	actions: VaultAction[],
): ResultAsync<void, CommandError> {
	return new ResultAsync(
		vam.dispatch(actions).then((dispatchResult) => {
			if (dispatchResult.isErr()) {
				const reason = dispatchResult.error
					.map((e) => e.error)
					.join(", ");
				return err({
					kind: CommandErrorKind.DispatchFailed,
					reason,
				});
			}
			return ok(undefined);
		}),
	);
}
