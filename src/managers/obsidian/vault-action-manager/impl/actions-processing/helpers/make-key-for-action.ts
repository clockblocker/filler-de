import { type VaultAction, VaultActionType } from "../../../types/vault-action";
import { makeKeyFor } from "../../common/collapse-helpers";

export function makeKeyForAction(action: VaultAction): string {
	switch (action.type) {
		case VaultActionType.RenameFolder:
		case VaultActionType.RenameFile:
		case VaultActionType.RenameMdFile:
			return makeKeyFor({ from: action.payload.from });

		default:
			return makeKeyFor({ splitPath: action.payload.splitPath });
	}
}
