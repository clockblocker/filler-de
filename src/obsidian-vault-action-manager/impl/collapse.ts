import type { VaultAction } from "../types/vault-action";
import { VaultActionType } from "../types/vault-action";
import { makeSystemPathForSplitPath } from "./split-path";

export async function collapseActions(
	actions: readonly VaultAction[],
): Promise<VaultAction[]> {
	const byPath = new Map<string, VaultAction>();

	for (const action of actions) {
		const key = getPathKey(action);
		const existing = byPath.get(key);

		// Trash wins - terminal operation
		if (isTrash(action)) {
			byPath.set(key, action);
			continue;
		}

		// If existing is trash, skip (trash already won)
		if (existing && isTrash(existing)) {
			continue;
		}

		// Rename rules: drop duplicates with same from->to; otherwise latest wins
		if (isRename(action)) {
			if (existing && sameRenameTarget(existing, action)) {
				continue;
			}
			byPath.set(key, action);
			continue;
		}

		// ProcessMdFile rules
		if (isProcess(action)) {
			if (existing) {
				if (isUpsertMdFile(existing)) {
					// Process on create - keep process (will read from disk)
					byPath.set(key, action);
					continue;
				}
				if (isProcess(existing)) {
					// Compose transforms
					const combined = async (content: string) => {
						const first = await existing.payload.transform(content);
						return await action.payload.transform(first);
					};
					byPath.set(key, {
						...existing,
						payload: {
							...existing.payload,
							transform: combined,
						},
					});
					continue;
				}
			}
			byPath.set(key, action);
			continue;
		}

		// UpsertMdFile rules
		if (isUpsertMdFile(action)) {
			if (existing) {
				if (existing.type === VaultActionType.UpsertMdFile) {
					// Both UpsertMdFile - collapse based on content
					if (action.payload.content === null || action.payload.content === undefined) {
						// Action is EnsureExist, existing is actual create - keep existing
						continue;
					}
					if (existing.payload.content === null || existing.payload.content === undefined) {
						// Existing is EnsureExist, action is actual create - replace with action
						byPath.set(key, action);
						continue;
					}
					// Both have content - latest wins
					byPath.set(key, action);
					continue;
				}
			}
			byPath.set(key, action);
			continue;
		}

		// Default: newest wins for all other action types
		byPath.set(key, action);
	}

	return Array.from(byPath.values());
}

function getPathKey(action: VaultAction): string {
	switch (action.type) {
		case VaultActionType.RenameFolder:
		case VaultActionType.RenameFile:
		case VaultActionType.RenameMdFile:
			return makeSystemPathForSplitPath(action.payload.from);
		case VaultActionType.CreateFolder:
		case VaultActionType.TrashFolder:
		case VaultActionType.CreateFile:
		case VaultActionType.TrashFile:
		case VaultActionType.UpsertMdFile:
		case VaultActionType.TrashMdFile:
		case VaultActionType.ProcessMdFile:
			return makeSystemPathForSplitPath(action.payload.splitPath);
	}
}

function isTrash(
	action: VaultAction,
): action is Extract<
	VaultAction,
	| { type: typeof VaultActionType.TrashFolder }
	| { type: typeof VaultActionType.TrashFile }
	| { type: typeof VaultActionType.TrashMdFile }
> {
	return (
		action.type === VaultActionType.TrashFolder ||
		action.type === VaultActionType.TrashFile ||
		action.type === VaultActionType.TrashMdFile
	);
}

function isRename(
	action: VaultAction,
): action is Extract<
	VaultAction,
	| { type: typeof VaultActionType.RenameFolder }
	| { type: typeof VaultActionType.RenameFile }
	| { type: typeof VaultActionType.RenameMdFile }
> {
	return (
		action.type === VaultActionType.RenameFolder ||
		action.type === VaultActionType.RenameFile ||
		action.type === VaultActionType.RenameMdFile
	);
}

function isProcess(
	action: VaultAction,
): action is Extract<
	VaultAction,
	{ type: typeof VaultActionType.ProcessMdFile }
> {
	return action.type === VaultActionType.ProcessMdFile;
}

function isUpsertMdFile(
	action: VaultAction,
): action is Extract<
	VaultAction,
	{ type: typeof VaultActionType.UpsertMdFile }
> {
	return action.type === VaultActionType.UpsertMdFile;
}

function sameRenameTarget(a: VaultAction, b: VaultAction): boolean {
	if (
		a.type === VaultActionType.RenameFolder &&
		b.type === VaultActionType.RenameFolder
	) {
		return (
			makeSystemPathForSplitPath(a.payload.from) ===
				makeSystemPathForSplitPath(b.payload.from) &&
			makeSystemPathForSplitPath(a.payload.to) ===
				makeSystemPathForSplitPath(b.payload.to)
		);
	}
	if (
		a.type === VaultActionType.RenameFile &&
		b.type === VaultActionType.RenameFile
	) {
		return (
			makeSystemPathForSplitPath(a.payload.from) ===
				makeSystemPathForSplitPath(b.payload.from) &&
			makeSystemPathForSplitPath(a.payload.to) ===
				makeSystemPathForSplitPath(b.payload.to)
		);
	}
	if (
		a.type === VaultActionType.RenameMdFile &&
		b.type === VaultActionType.RenameMdFile
	) {
		return (
			makeSystemPathForSplitPath(a.payload.from) ===
				makeSystemPathForSplitPath(b.payload.from) &&
			makeSystemPathForSplitPath(a.payload.to) ===
				makeSystemPathForSplitPath(b.payload.to)
		);
	}
	return false;
}
