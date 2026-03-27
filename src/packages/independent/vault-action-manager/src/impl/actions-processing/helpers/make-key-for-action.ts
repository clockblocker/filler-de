import { getActionSplitPath } from "../../../helpers/action-helpers";
import type { VaultAction } from "../../../types/vault-action";
import { makeKeyFor } from "../../common/collapse-helpers";

export function makeKeyForAction(action: VaultAction): string {
	// getActionSplitPath returns 'from' for rename actions, 'splitPath' otherwise
	return makeKeyFor({ splitPath: getActionSplitPath(action) });
}
