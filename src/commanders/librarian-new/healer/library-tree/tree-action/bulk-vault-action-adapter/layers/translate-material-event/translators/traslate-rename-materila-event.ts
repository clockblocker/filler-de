import type { Codecs } from "../../../../../../codecs";
import {
	type MoveNodeAction,
	type RenameNodeAction,
	TreeActionType,
} from "../../../../types/tree-action";
import {
	getNodeName,
	getParentLocator,
} from "../../../../utils/locator/locator-utils";
import type { RenameTreeNodeNodeMaterializedEvent } from "../../materialized-node-events/types";
import { inferPolicyAndIntent, RenameIntent } from "../policy-and-intent";
import {
	tryMakeDestinationLocatorFromEvent,
	tryMakeTargetLocatorFromLibraryScopedSplitPath,
} from "./helpers/locator";

export function traslateRenameMaterializedEvent(
	ev: RenameTreeNodeNodeMaterializedEvent,
	codecs: Codecs,
): Array<RenameNodeAction | MoveNodeAction> {
	const out: Array<RenameNodeAction | MoveNodeAction> = [];

	const { intent } = inferPolicyAndIntent(ev, codecs);

	// 1) target = current node location in tree (FROM)
	const targetRes = tryMakeTargetLocatorFromLibraryScopedSplitPath(
		ev.from,
		codecs,
	);
	if (targetRes.isErr()) return out;
	const targetLocator = targetRes.value;

	// 2) destination canonical (TO + policy/intent)
	const destinationRes = tryMakeDestinationLocatorFromEvent(ev, codecs);
	if (destinationRes.isErr()) return out;
	const destinationLocator = destinationRes.value;

	const newNodeName = getNodeName(destinationLocator);
	const newParentLocator = getParentLocator(destinationLocator);

	if (intent === RenameIntent.Rename) {
		out.push({
			actionType: TreeActionType.Rename,
			newNodeName,
			targetLocator,
		} as RenameNodeAction);
		return out;
	}

	out.push({
		actionType: TreeActionType.Move,
		newNodeName,
		newParentLocator,
		observedSplitPath: ev.to, // observed after user op
		targetLocator,
	} as MoveNodeAction);

	return out;
}
