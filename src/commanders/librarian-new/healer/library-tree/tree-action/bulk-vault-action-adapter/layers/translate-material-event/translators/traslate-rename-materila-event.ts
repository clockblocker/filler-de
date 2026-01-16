import { logger } from "../../../../../../../../../utils/logger";
import type { Codecs } from "../../../../../../../codecs";
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
import { tryMakeDestinationLocatorFromEvent } from "./helpers/event-to-locator";
import { tryMakeTargetLocatorFromLibraryScopedSplitPath } from "./helpers/split-path-to-locator";

export function traslateRenameMaterializedEvent(
	ev: RenameTreeNodeNodeMaterializedEvent,
	codecs: Codecs,
): Array<RenameNodeAction | MoveNodeAction> {
	const out: Array<RenameNodeAction | MoveNodeAction> = [];

	const { intent, policy } = inferPolicyAndIntent(ev, codecs);

	logger.info("[translateRename] Event:", JSON.stringify({
		from: { basename: ev.from.basename, pathParts: ev.from.pathParts, kind: ev.from.kind },
		to: { basename: ev.to.basename, pathParts: ev.to.pathParts, kind: ev.to.kind },
		nodeKind: ev.nodeKind,
		intent,
		policy,
	}));

	// 1) target = current node location in tree (FROM)
	const targetRes = tryMakeTargetLocatorFromLibraryScopedSplitPath(
		ev.from,
		codecs,
	);
	if (targetRes.isErr()) {
		logger.warn("[translateRename] targetRes error:", targetRes.error);
		return out;
	}
	const targetLocator = targetRes.value;

	// 2) destination canonical (TO + policy/intent)
	const destinationRes = tryMakeDestinationLocatorFromEvent(ev, codecs);
	if (destinationRes.isErr()) {
		logger.warn("[translateRename] destinationRes error:", destinationRes.error);
		return out;
	}
	const destinationLocator = destinationRes.value;

	const newNodeName = getNodeName(destinationLocator);
	const newParentLocator = getParentLocator(destinationLocator);

	logger.info("[translateRename] Locators:", JSON.stringify({
		targetLocator,
		destinationLocator,
		newNodeName,
		newParentLocator,
	}));

	if (intent === RenameIntent.Rename) {
		logger.info("[translateRename] Creating RenameNodeAction");
		out.push({
			actionType: TreeActionType.Rename,
			newNodeName,
			targetLocator,
		} as RenameNodeAction);
		return out;
	}

	logger.info("[translateRename] Creating MoveNodeAction");
	out.push({
		actionType: TreeActionType.Move,
		newNodeName,
		newParentLocator,
		observedSplitPath: ev.to, // observed after user op
		targetLocator,
	} as MoveNodeAction);

	return out;
}
