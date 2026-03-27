import type { Codecs } from "../../../../../../../codecs";
import { TreeNodeKind } from "../../../../../tree-node/types/atoms";
import {
	type DeleteNodeAction,
	TreeActionType,
} from "../../../../types/tree-action";
import type { DeleteTreeNodeMaterializedEvent } from "../../materialized-node-events/types";
import { tryMakeDestinationLocatorFromEvent } from "./helpers/event-to-locator";

export function traslateDeleteMaterializedEvent(
	ev: DeleteTreeNodeMaterializedEvent,
	codecs: Codecs,
): DeleteNodeAction[] {
	const out: DeleteNodeAction[] = [];

	const targetRes = tryMakeDestinationLocatorFromEvent(ev, codecs);
	if (targetRes.isErr()) return out;

	const targetLocator = targetRes.value;

	switch (targetLocator.targetKind) {
		case TreeNodeKind.File: {
			out.push({
				actionType: TreeActionType.Delete,
				targetLocator,
			});
			break;
		}
		case TreeNodeKind.Scroll: {
			out.push({
				actionType: TreeActionType.Delete,
				targetLocator,
			});
			break;
		}
		case TreeNodeKind.Section: {
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
