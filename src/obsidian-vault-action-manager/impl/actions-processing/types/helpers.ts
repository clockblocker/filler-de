import { type VaultAction, VaultActionType } from "../../../types/vault-action";

export type TrashAction = Extract<
	VaultAction,
	| { type: typeof VaultActionType.TrashFolder }
	| { type: typeof VaultActionType.TrashFile }
	| { type: typeof VaultActionType.TrashMdFile }
>;

export function isTrashAction(action: VaultAction): action is TrashAction {
	return (
		action.type === VaultActionType.TrashFolder ||
		action.type === VaultActionType.TrashFile ||
		action.type === VaultActionType.TrashMdFile
	);
}

export type RenameAction = Extract<
	VaultAction,
	| { type: typeof VaultActionType.RenameFolder }
	| { type: typeof VaultActionType.RenameFile }
	| { type: typeof VaultActionType.RenameMdFile }
>;
export function isRenameAction(action: VaultAction): action is RenameAction {
	return (
		action.type === VaultActionType.RenameFolder ||
		action.type === VaultActionType.RenameFile ||
		action.type === VaultActionType.RenameMdFile
	);
}

export type ProcessAction = Extract<
	VaultAction,
	{ type: typeof VaultActionType.ProcessMdFile }
>;

export function isProcessAction(
	action: VaultAction,
): action is Extract<
	VaultAction,
	{ type: typeof VaultActionType.ProcessMdFile }
> {
	return action.type === VaultActionType.ProcessMdFile;
}

export type UpsertMdFileAction = Extract<
	VaultAction,
	{ type: typeof VaultActionType.UpsertMdFile }
>;

export function isUpsertMdFileAction(
	action: VaultAction,
): action is Extract<
	VaultAction,
	{ type: typeof VaultActionType.UpsertMdFile }
> {
	return action.type === VaultActionType.UpsertMdFile;
}
