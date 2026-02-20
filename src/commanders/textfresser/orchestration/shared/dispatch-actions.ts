import { err, ok, ResultAsync } from "neverthrow";
import type {
	VaultAction,
	VaultActionManager,
} from "../../../../managers/obsidian/vault-action-manager";
import type { CommandError } from "../../commands/types";
import { CommandErrorKind } from "../../errors";

function stringifySplitPath(splitPath: {
	pathParts: string[];
	basename: string;
}): string {
	return [...splitPath.pathParts, splitPath.basename].join("/");
}

function formatDispatchFailure(failure: {
	action: VaultAction;
	error: string;
}): string {
	const action = failure.action;
	switch (action.kind) {
		case "RenameFolder":
		case "RenameFile":
		case "RenameMdFile":
			return `${action.kind}(${stringifySplitPath(action.payload.from)} -> ${stringifySplitPath(action.payload.to)}): ${failure.error}`;
		default:
			return `${action.kind}(${stringifySplitPath(action.payload.splitPath)}): ${failure.error}`;
	}
}

export function dispatchActions(
	vam: VaultActionManager,
	actions: VaultAction[],
): ResultAsync<void, CommandError> {
	return new ResultAsync(
		vam.dispatch(actions).then((dispatchResult) => {
			if (dispatchResult.isErr()) {
				const reason = dispatchResult.error
					.map((failure) => formatDispatchFailure(failure))
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
