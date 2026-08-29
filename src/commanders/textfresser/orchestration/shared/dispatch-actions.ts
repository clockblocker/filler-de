import type {
	VaultAction,
	VaultActionManager,
} from "@textfresser/vault-action-manager";
import { Effect } from "effect";
import type { CommandError } from "../../commands/types";
import { vamDispatchFailureToCommandError } from "./vam-failure";

export function dispatchActions(
	vam: VaultActionManager,
	actions: readonly VaultAction[],
): Effect.Effect<void, CommandError> {
	return vam
		.dispatch(actions)
		.pipe(
			Effect.mapError((error) =>
				vamDispatchFailureToCommandError(error, actions),
			),
		);
}
