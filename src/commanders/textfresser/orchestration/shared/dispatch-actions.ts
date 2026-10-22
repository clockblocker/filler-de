import type {
	VaultAction,
	VaultActionManager,
} from "@textfresser/vault-action-manager";
import { Effect } from "effect";
import type { CommandError } from "../../commands/types";
import { CommandErrorKind } from "../../errors";

export function dispatchActions(
	vam: VaultActionManager,
	actions: readonly VaultAction[],
): Effect.Effect<void, CommandError> {
	return vam.dispatch(actions).pipe(
		Effect.mapError(
			(error): CommandError => ({
				kind: CommandErrorKind.DispatchFailed,
				reason: error.message,
			}),
		),
	);
}
