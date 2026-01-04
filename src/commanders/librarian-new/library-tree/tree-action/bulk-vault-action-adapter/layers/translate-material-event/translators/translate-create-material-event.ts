import { TreeNodeType } from "../../../../../tree-node/types/atoms";
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
	const observedVaultSplitPath = ev.splitPath;

	if (targetRes.isErr()) return out;
	const targetLocator = targetRes.value;

	switch (targetLocator.targetType) {
		case TreeNodeType.File: {
			if (observedVaultSplitPath.type !== "File") {
				break;
			}
			out.push({
				actionType: TreeActionType.Create,
				observedVaultSplitPath: observedVaultSplitPath,
				targetLocator,
			});
			break;
		}
		case TreeNodeType.Scroll: {
			if (observedVaultSplitPath.type !== "MdFile") {
				break;
			}
			out.push({
				actionType: TreeActionType.Create,
				observedVaultSplitPath,
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
