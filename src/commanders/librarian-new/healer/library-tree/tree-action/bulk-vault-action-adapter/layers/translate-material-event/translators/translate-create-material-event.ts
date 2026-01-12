import { TreeNodeKind } from "../../../../../tree-node/types/atoms";
import {
	type CreateTreeLeafAction,
	TreeActionType,
} from "../../../../types/tree-action";
import type { CreateLeafNodeMaterializedEvent } from "../../materialized-node-events/types";
import { tryMakeDestinationLocatorFromEvent } from "./helpers/locator";

export function traslateCreateMaterializedEvent(
	ev: CreateLeafNodeMaterializedEvent,
): CreateTreeLeafAction[] {
	const out: CreateTreeLeafAction[] = [];

	const targetRes = tryMakeDestinationLocatorFromEvent(ev);
	const observedSplitPath = ev.splitPath;

	if (targetRes.isErr()) return out;
	const targetLocator = targetRes.value;

	switch (targetLocator.targetKind) {
		case TreeNodeKind.File: {
			if (observedSplitPath.kind !== "File") {
				break;
			}
			out.push({
				actionType: TreeActionType.Create,
				observedSplitPath,
				targetLocator,
			});
			break;
		}
		case TreeNodeKind.Scroll: {
			if (observedSplitPath.kind !== "MdFile") {
				break;
			}
			out.push({
				actionType: TreeActionType.Create,
				observedSplitPath,
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
