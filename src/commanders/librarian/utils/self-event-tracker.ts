import type { CoreSplitPath } from "../../../obsidian-vault-action-manager/types/split-path";
import {
	type VaultAction,
	VaultActionType,
} from "../../../obsidian-vault-action-manager/types/vault-action";

function normalizeSystemPath(path: string): string {
	return path.replace(/^[\\/]+|[\\/]+$/g, "");
}

function stripMd(path: string): string {
	return path.replace(/\.md$/i, "");
}

function toSystemKey(core: CoreSplitPath): string {
	const segments = [...core.pathParts, core.basename];
	return normalizeSystemPath(segments.join("/"));
}

/**
 * Tracks vault actions initiated by the plugin so incoming Obsidian events
 * can be ignored when they originate from us.
 *
 * Assumes events carry `file.path`-style strings (slash-separated).
 */
export class LegacySelfEventTracker {
	private readonly keys = new Set<string>();

	register(actions: VaultAction[]): void {
		for (const action of actions) {
			switch (action.type) {
				case VaultActionType.RenameMdFile:
				case VaultActionType.RenameFile: {
					this.keys.add(toSystemKey(action.payload.from));
					this.keys.add(toSystemKey(action.payload.to));
					break;
				}
				case VaultActionType.RenameFolder: {
					this.keys.add(toSystemKey(action.payload.from));
					this.keys.add(toSystemKey(action.payload.to));
					break;
				}
				case VaultActionType.TrashFile:
				case VaultActionType.TrashMdFile:
				case VaultActionType.CreateFile:
				case VaultActionType.CreateMdFile:
				case VaultActionType.ProcessMdFile:
				case VaultActionType.WriteMdFile: {
					this.keys.add(toSystemKey(action.payload.coreSplitPath));
					break;
				}
				case VaultActionType.CreateFolder:
				case VaultActionType.TrashFolder: {
					this.keys.add(toSystemKey(action.payload.coreSplitPath));
					break;
				}
				default:
					break;
			}
		}
	}

	pop(path: string): boolean {
		const normalized = stripMd(normalizeSystemPath(path));
		if (this.keys.has(normalized)) {
			this.keys.delete(normalized);
			return true;
		}
		return false;
	}
}
