import type { RenameTreeNodeNodeMaterializedEvent } from "../../../bulk-vault-action-adapter/layers/materialized-node-events/types";
import type { ChangePolicy } from "./types";

export function inferMovePolicy({
	libraryScopedTo,
	libraryScopedFrom,
}: RenameTreeNodeNodeMaterializedEvent): ChangePolicy {
    
}
