import type { BulkVaultEvent } from "../../../../../obsidian-vault-action-manager";
import type { TreeAction } from "../types/tree-action";
import { makeLibraryScopedBulkVaultEvent } from "./layers/library-scope";
import { materializeScopedBulk } from "./layers/materialized-node-events";
import { translateMaterializedEvents } from "./layers/translate-material-event/translate-material-events";

export const buildTreeActions = (bulk: BulkVaultEvent): TreeAction[] => {
	return translateMaterializedEvents(
		materializeScopedBulk(makeLibraryScopedBulkVaultEvent(bulk)),
	);
};
