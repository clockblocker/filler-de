import { TreeNodeType } from "../../../../../tree-node/types/atoms";
import {
	type DeleteNodeAction,
	TreeActionType,
} from "../../../../types/tree-action";
import type { DeleteTreeNodeMaterializedEvent } from "../../materialized-node-events/types";
import { tryMakeDestinationLocatorFromEvent } from "./helpers/locator";

export function traslateDeleteMaterializedEvent(
	ev: DeleteTreeNodeMaterializedEvent,
): DeleteNodeAction[] {
	const out: DeleteNodeAction[] = [];

	const targetRes = tryMakeDestinationLocatorFromEvent(ev);
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
