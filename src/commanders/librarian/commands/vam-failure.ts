import type { VaultAction } from "@textfresser/vault-action-manager";
import type {
	VamDispatchError,
	VamEffectError,
} from "@textfresser/vault-action-manager/facade";
import { getErrorMessage } from "../../../utils/get-error-message";
import { type CommandError, CommandErrorKind } from "../errors";

export type LibrarianVamFailure = VamEffectError | readonly VamDispatchError[];
type DispatchCommandError = Extract<
	CommandError,
	{ kind: typeof CommandErrorKind.DispatchFailed }
>;

function describeDispatchError(
	error: VamDispatchError,
	fallback: VaultAction | undefined,
): string {
	const action = (error.action as VaultAction | undefined) ?? fallback;
	const detail = getErrorMessage(error.cause);
	const operation = action
		? `${error.operation} (${action.kind})`
		: error.operation;
	return `${operation}: ${detail}`;
}

export function describeLibrarianVamFailure(
	error: LibrarianVamFailure,
	actions: readonly VaultAction[] = [],
): string {
	if (Array.isArray(error)) {
		return error
			.map((failure) => describeDispatchError(failure, actions[0]))
			.join(", ");
	}

	const failure = error as VamEffectError;
	return `${failure.operation}: ${getErrorMessage(failure.cause)}`;
}

export function vamFailureToCommandError(
	error: LibrarianVamFailure,
	actions: readonly VaultAction[] = [],
): DispatchCommandError {
	return {
		kind: CommandErrorKind.DispatchFailed,
		reason: describeLibrarianVamFailure(error, actions),
	};
}
