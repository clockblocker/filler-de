import {
	type LegacyVaultAction,
	LegacyVaultActionType,
} from "../../../services/obsidian-services/file-services/background/background-vault-actions";
import type { PrettyPathLegacy } from "../../../types/common-interface/dtos";

function normalizeSystemPath(path: string): string {
	return path.replace(/^[\\/]+|[\\/]+$/g, "");
}

function toSystemKey(prettyPath: PrettyPathLegacy): string {
	const segments = [...prettyPath.pathParts, `${prettyPath.basename}.md`];
	return normalizeSystemPath(segments.join("/"));
}

/**
 * Tracks vault actions initiated by the plugin so incoming Obsidian events
 * can be ignored when they originate from us.
 *
 * Assumes events carry `file.path`-style strings (slash-separated).
 */
export class SelfEventTrackerLegacy {
	private readonly keys = new Set<string>();

	register(actions: LegacyVaultAction[]): void {
		for (const action of actions) {
			switch (action.type) {
				case LegacyVaultActionType.RenameFile: {
					this.keys.add(toSystemKey(action.payload.from));
					this.keys.add(toSystemKey(action.payload.to));
					break;
				}
				case LegacyVaultActionType.TrashFile:
				case LegacyVaultActionType.UpdateOrCreateFile:
				case LegacyVaultActionType.ProcessFile:
				case LegacyVaultActionType.WriteFile: {
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
