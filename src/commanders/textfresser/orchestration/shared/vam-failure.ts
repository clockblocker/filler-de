import type { VaultAction } from "@textfresser/vault-action-manager";
import {
	VamDispatchError,
	type VamEffectError,
} from "@textfresser/vault-action-manager/facade";
import { getErrorMessage } from "../../../../utils/get-error-message";
import type { CommandError } from "../../commands/types";
import { CommandErrorKind } from "../../errors";

export function describeVamFailure(error: VamEffectError): string {
	return `${error.operation}: ${getErrorMessage(error.cause)}`;
}

type VamDispatchFailure = VamEffectError | readonly VamDispatchError[];

function stringifySplitPath(splitPath: {
	readonly pathParts: readonly string[];
	readonly basename: string;
}): string {
	return [...splitPath.pathParts, splitPath.basename].join("/");
}

function describeAction(action: VaultAction): string {
	switch (action.kind) {
		case "RenameFolder":
		case "RenameFile":
		case "RenameMdFile":
			return `${action.kind}(${stringifySplitPath(action.payload.from)} -> ${stringifySplitPath(action.payload.to)})`;
		default:
			return `${action.kind}(${stringifySplitPath(action.payload.splitPath)})`;
	}
}

function describeDispatchError(
	error: VamDispatchError,
	fallback: VaultAction | undefined,
): string {
	const action = (error.action as VaultAction | undefined) ?? fallback;
	const detail = getErrorMessage(error.cause);
	const reason = detail || `Vault action failed during ${error.operation}`;
	return action ? `${describeAction(action)}: ${reason}` : reason;
}

export function vamDispatchFailureToCommandError(
	error: VamDispatchFailure,
	actions: readonly VaultAction[],
): CommandError {
	const fallback = actions[0];
	const reason = Array.isArray(error)
		? error
				.map((failure) => describeDispatchError(failure, fallback))
				.join(", ")
		: error instanceof VamDispatchError
			? describeDispatchError(error, fallback)
			: describeVamFailure(error as VamEffectError);
	return {
		kind: CommandErrorKind.DispatchFailed,
		reason,
	};
}

export function vamIoFailureToCommandError(
	error: VamEffectError,
): CommandError {
	return {
		kind: CommandErrorKind.ApiError,
		reason: describeVamFailure(error),
	};
}
