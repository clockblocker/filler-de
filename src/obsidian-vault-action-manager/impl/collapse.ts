import type { VaultAction } from "../types/vault-action";
import { VaultActionType } from "../types/vault-action";

function isProcess(
	action: VaultAction,
): action is Extract<
	VaultAction,
	{ type: typeof VaultActionType.ProcessMdFile }
> {
	return action.type === VaultActionType.ProcessMdFile;
}

function isWrite(
	action: VaultAction,
): action is Extract<
	VaultAction,
	{ type: typeof VaultActionType.WriteMdFile }
> {
	return action.type === VaultActionType.WriteMdFile;
}

function sameRenameTarget(a: VaultAction, b: VaultAction): boolean {
	if (
		a.type === VaultActionType.RenameFolder &&
		b.type === VaultActionType.RenameFolder
	) {
		return (
			a.payload.from.basename === b.payload.from.basename &&
			a.payload.from.pathParts.join("/") ===
				b.payload.from.pathParts.join("/") &&
			a.payload.to.basename === b.payload.to.basename &&
			a.payload.to.pathParts.join("/") ===
				b.payload.to.pathParts.join("/")
		);
	}
	if (
		a.type === VaultActionType.RenameFile &&
		b.type === VaultActionType.RenameFile
	) {
		return (
			a.payload.from.basename === b.payload.from.basename &&
			a.payload.from.pathParts.join("/") ===
				b.payload.from.pathParts.join("/") &&
			a.payload.to.basename === b.payload.to.basename &&
			a.payload.to.pathParts.join("/") ===
				b.payload.to.pathParts.join("/")
		);
	}
	if (
		a.type === VaultActionType.RenameMdFile &&
		b.type === VaultActionType.RenameMdFile
	) {
		return (
			a.payload.from.basename === b.payload.from.basename &&
			a.payload.from.pathParts.join("/") ===
				b.payload.from.pathParts.join("/") &&
			a.payload.to.basename === b.payload.to.basename &&
			a.payload.to.pathParts.join("/") ===
				b.payload.to.pathParts.join("/")
		);
	}
	return false;
}

export async function collapseActions(
	actions: readonly VaultAction[],
): Promise<VaultAction[]> {
	const byPath = new Map<string, VaultAction>();

	for (const action of actions) {
		const key = getPathKey(action);
		const existing = byPath.get(key);

		// Rename rules: drop duplicates with same from->to; otherwise latest wins.
		if (
			action.type === VaultActionType.RenameFolder ||
			action.type === VaultActionType.RenameFile ||
			action.type === VaultActionType.RenameMdFile
		) {
			if (existing && sameRenameTarget(existing, action)) {
				continue;
			}
			byPath.set(key, action);
			continue;
		}

		// Writes: latest wins; replaces prior write/process/any.
		if (isWrite(action)) {
			byPath.set(key, action);
			continue;
		}

		// Process rules
		if (isProcess(action)) {
			if (existing) {
				if (isWrite(existing)) {
					const nextContent = await Promise.resolve(
						action.payload.transform(existing.payload.content),
					);
					byPath.set(key, {
						...existing,
						payload: { ...existing.payload, content: nextContent },
					});
					continue;
				}
				if (isProcess(existing)) {
					const combined = async (content: string) =>
						action.payload.transform(
							await Promise.resolve(
								existing.payload.transform(content),
							),
						);
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

		// Default: newest wins for all other action types.
		byPath.set(key, action);
	}

	return Array.from(byPath.values());
}

function getPathKey(action: VaultAction): string {
	switch (action.type) {
		case VaultActionType.RenameFolder:
		case VaultActionType.RenameFile:
		case VaultActionType.RenameMdFile:
			return coreKey(action.payload.from);
		case VaultActionType.CreateFolder:
		case VaultActionType.TrashFolder:
		case VaultActionType.CreateFile:
		case VaultActionType.TrashFile:
		case VaultActionType.CreateMdFile:
		case VaultActionType.TrashMdFile:
		case VaultActionType.ProcessMdFile:
		case VaultActionType.WriteMdFile:
			return coreKey(action.payload.coreSplitPath);
	}
}

function coreKey(core: { pathParts: string[]; basename: string }): string {
	return [...core.pathParts, core.basename].join("/");
}
