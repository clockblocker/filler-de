import {
	type VaultAction,
	VaultActionType,
} from "../../../services/obsidian-services/file-services/background/background-vault-actions";
import type { PrettyPath } from "../../../types/common-interface/dtos";

function normalizeSystemPath(path: string): string {
	return path.replace(/^[\\/]+|[\\/]+$/g, "");
}

function toSystemKey(prettyPath: PrettyPath): string {
	const segments = [...prettyPath.pathParts, `${prettyPath.basename}.md`];
	return normalizeSystemPath(segments.join("/"));
}

/**
 * Tracks vault actions initiated by the plugin so incoming Obsidian events
 * can be ignored when they originate from us.
 *
 * Assumes events carry `file.path`-style strings (slash-separated).
 */
export class SelfEventTracker {
	private readonly keys = new Set<string>();

	register(actions: VaultAction[]): void {
		for (const action of actions) {
			switch (action.type) {
				case VaultActionType.RenameFile: {
					this.keys.add(toSystemKey(action.payload.from));
					this.keys.add(toSystemKey(action.payload.to));
					break;
				}
				case VaultActionType.TrashFile:
				case VaultActionType.UpdateOrCreateFile:
				case VaultActionType.ProcessFile:
				case VaultActionType.WriteFile: {
					this.keys.add(toSystemKey(action.payload.prettyPath));
					break;
				}
				default:
					break;
			}
		}
	}

	pop(path: string): boolean {
		const normalized = normalizeSystemPath(path);
		if (this.keys.has(normalized)) {
			this.keys.delete(normalized);
			return true;
		}
		return false;
	}
}
