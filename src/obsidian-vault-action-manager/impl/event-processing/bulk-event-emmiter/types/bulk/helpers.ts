import { type VaultEvent, VaultEventType } from "../../../../..";

export type RenameVaultEvent =
	| Extract<VaultEvent, { type: typeof VaultEventType.FileRenamed }>
	| Extract<VaultEvent, { type: typeof VaultEventType.FolderRenamed }>;

export function isRename(e: VaultEvent): e is RenameVaultEvent {
	return (
		e.type === VaultEventType.FileRenamed ||
		e.type === VaultEventType.FolderRenamed
	);
}

export type TrashVaultEvent =
	| Extract<VaultEvent, { type: typeof VaultEventType.FileTrashed }>
	| Extract<VaultEvent, { type: typeof VaultEventType.FolderTrashed }>;

export function isDelete(e: VaultEvent): e is TrashVaultEvent {
	return (
		e.type === VaultEventType.FileTrashed ||
		e.type === VaultEventType.FolderTrashed
	);
}

export type CreateVaultEvent =
	| Extract<VaultEvent, { type: typeof VaultEventType.FileCreated }>
	| Extract<VaultEvent, { type: typeof VaultEventType.FolderCreated }>;

export function isCreate(e: VaultEvent): e is CreateVaultEvent {
	return (
		e.type === VaultEventType.FileCreated ||
		e.type === VaultEventType.FolderCreated
	);
}

export type PossibleRootVaultEvent = RenameVaultEvent | TrashVaultEvent;

export function isPossibleRoot(e: VaultEvent): e is PossibleRootVaultEvent {
	return isRename(e) || isDelete(e);
}
