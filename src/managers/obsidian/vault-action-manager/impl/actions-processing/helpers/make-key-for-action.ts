import { type VaultAction, VaultActionKind } from "../../../types/vault-action";
import { makeKeyFor } from "../../common/collapse-helpers";

export function makeKeyForAction(action: VaultAction): string {
	switch (action.kind) {
		case VaultActionKind.RenameFolder:
		case VaultActionKind.RenameFile:
		case VaultActionKind.RenameMdFile:
			return makeKeyFor({ from: action.payload.from });

		default:
			return makeKeyFor({ splitPath: action.payload.splitPath });
	}
}
