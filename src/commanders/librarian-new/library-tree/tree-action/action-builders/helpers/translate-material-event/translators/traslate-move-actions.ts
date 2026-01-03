import type { RenameTreeNodeNodeMaterializedEvent } from "../../../../bulk-vault-action-adapter/layers/materialized-node-events/types";
import {
	type MoveNodeAction,
	type RenameNodeAction,
	TreeActionType,
} from "../../../../types/tree-action";
import { getNodeName, getParentLocator } from "../../../../utils/locator-utils";
import { inferPolicyAndIntent, RenameIntent } from "../../policy-and-intent";
import { tryMakeTargetLocator } from "./helpers/locator";

export function traslateRenameMaterializedEvent(
	ev: RenameTreeNodeNodeMaterializedEvent,
): Array<RenameNodeAction | MoveNodeAction> {
	const out: Array<RenameNodeAction | MoveNodeAction> = [];

	const { intent } = inferPolicyAndIntent(ev);

	const targetRes = tryMakeTargetLocator(ev);
	if (targetRes.isErr()) return out;
	const targetLocator = targetRes.value;
	const newNodeName = getNodeName(targetLocator);

	if (intent === RenameIntent.Rename) {
		out.push({
			actionType: TreeActionType.Rename,
			newNodeName,
			targetLocator,
		} as RenameNodeAction);
		return out;
	}

	// MOVE intent
	const newParentLocator = getParentLocator(targetLocator);

	out.push({
		actionType: TreeActionType.Move,
		newNodeName,
		newParentLocator,
		observedVaultSplitPath: ev.to,
		targetLocator,
	} as MoveNodeAction);

	return out;
}
