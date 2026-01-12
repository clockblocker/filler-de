import { type VaultAction, VaultActionKind } from "../../../types/vault-action";

export type TrashAction = Extract<
	VaultAction,
	| { kind: typeof VaultActionKind.TrashFolder }
	| { kind: typeof VaultActionKind.TrashFile }
	| { kind: typeof VaultActionKind.TrashMdFile }
>;

export function isTrashAction(action: VaultAction): action is TrashAction {
	return (
		action.kind === VaultActionKind.TrashFolder ||
		action.kind === VaultActionKind.TrashFile ||
		action.kind === VaultActionKind.TrashMdFile
	);
}

export type RenameAction = Extract<
	VaultAction,
	| { kind: typeof VaultActionKind.RenameFolder }
	| { kind: typeof VaultActionKind.RenameFile }
	| { kind: typeof VaultActionKind.RenameMdFile }
>;
export function isRenameAction(action: VaultAction): action is RenameAction {
	return (
		action.kind === VaultActionKind.RenameFolder ||
		action.kind === VaultActionKind.RenameFile ||
		action.kind === VaultActionKind.RenameMdFile
	);
}

export type ProcessAction = Extract<
	VaultAction,
	{ kind: typeof VaultActionKind.ProcessMdFile }
>;

export function isProcessAction(
	action: VaultAction,
): action is Extract<
	VaultAction,
	{ kind: typeof VaultActionKind.ProcessMdFile }
> {
	return action.kind === VaultActionKind.ProcessMdFile;
}

export type UpsertMdFileAction = Extract<
	VaultAction,
	{ kind: typeof VaultActionKind.UpsertMdFile }
>;

export function isUpsertMdFileAction(
	action: VaultAction,
): action is Extract<
	VaultAction,
	{ kind: typeof VaultActionKind.UpsertMdFile }
> {
	return action.kind === VaultActionKind.UpsertMdFile;
}
