import { TreeNodeType } from "../../../../../tree-node/types/atoms";
import type { DeleteTreeNodeMaterializedEvent } from "../../../../bulk-vault-action-adapter/layers/materialized-node-events/types";
import {
	type DeleteFileNodeAction,
	type DeleteNodeAction,
	type DeleteScrollNodeAction,
	type DeleteSectionNodeAction,
	TreeActionType,
} from "../../../../types/tree-action";
import { tryMakeTargetLocator } from "./helpers/locator";

export function traslateDeleteMaterializedEvent(
	ev: DeleteTreeNodeMaterializedEvent,
): DeleteNodeAction[] {
	const out: DeleteNodeAction[] = [];

	const targetRes = tryMakeTargetLocator(ev);
	if (targetRes.isErr()) return out;

	const targetLocator = targetRes.value;

	switch (targetLocator.targetType) {
		case TreeNodeType.File: {
			out.push({
				actionType: TreeActionType.Delete,
				targetLocator,
			});
			break;
		}
		case TreeNodeType.Scroll: {
			out.push({
				actionType: TreeActionType.Delete,
				targetLocator,
			});
			break;
		}
		case TreeNodeType.Section: {
			out.push({
				actionType: TreeActionType.Delete,
				targetLocator,
			});
			break;
		}
		default: {
			break;
		}
	}

	return out;
}
