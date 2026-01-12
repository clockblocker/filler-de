import { type VaultEvent, VaultEventKind } from "../../../../..";

export type FileRenamedVaultEvent = Extract<
	VaultEvent,
	{ type: typeof VaultEventKind.FileRenamed }
>;
export type FolderRenamedVaultEvent = Extract<
	VaultEvent,
	{ type: typeof VaultEventKind.FolderRenamed }
>;
export type RenameVaultEvent = FileRenamedVaultEvent | FolderRenamedVaultEvent;

export function isRename(e: VaultEvent): e is RenameVaultEvent {
	return (
		e.kind === VaultEventKind.FileRenamed ||
		e.kind === VaultEventKind.FolderRenamed
	);
}

export type TrashVaultEvent =
	| Extract<VaultEvent, { type: typeof VaultEventKind.FileDeleted }>
	| Extract<VaultEvent, { type: typeof VaultEventKind.FolderDeleted }>;

export function isDelete(e: VaultEvent): e is TrashVaultEvent {
	return (
		e.kind === VaultEventKind.FileDeleted ||
		e.kind === VaultEventKind.FolderDeleted
	);
}

export type CreateVaultEvent =
	| Extract<VaultEvent, { type: typeof VaultEventKind.FileCreated }>
	| Extract<VaultEvent, { type: typeof VaultEventKind.FolderCreated }>;

export function isCreate(e: VaultEvent): e is CreateVaultEvent {
	return (
		e.kind === VaultEventKind.FileCreated ||
		e.type === VaultEventKind.FolderCreated
	);
}

export type PossibleRootVaultEvent = RenameVaultEvent | TrashVaultEvent;

export function isPossibleRoot(e: VaultEvent): e is PossibleRootVaultEvent {
	return isRename(e) || isDelete(e);
}
