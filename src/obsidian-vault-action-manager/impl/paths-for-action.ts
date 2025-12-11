import type { CoreSplitPath } from "../types/split-path";
import type { VaultAction } from "../types/vault-action";
import { VaultActionType } from "../types/vault-action";

function coreKey(core: CoreSplitPath): string {
	return [...core.pathParts, core.basename].join("/");
}

export function pathsForAction(actions: readonly VaultAction[]): string[] {
	const paths: string[] = [];
	for (const action of actions) {
		switch (action.type) {
			case VaultActionType.RenameFolder:
			case VaultActionType.RenameFile:
			case VaultActionType.RenameMdFile:
				paths.push(
					coreKey(action.payload.from),
					coreKey(action.payload.to),
				);
				break;
			case VaultActionType.CreateFolder:
			case VaultActionType.TrashFolder:
			case VaultActionType.CreateFile:
			case VaultActionType.TrashFile:
			case VaultActionType.CreateMdFile:
			case VaultActionType.TrashMdFile:
			case VaultActionType.ProcessMdFile:
			case VaultActionType.WriteMdFile:
				paths.push(coreKey(action.payload.coreSplitPath));
				break;
		}
	}
	return paths;
}
