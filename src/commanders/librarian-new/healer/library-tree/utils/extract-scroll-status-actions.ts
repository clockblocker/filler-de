import { logger } from "../../../../utils/logger";
import type { Codecs } from "../../../codecs";
import type { ScrollNodeSegmentId } from "../../../codecs/segment-id/types/segment-id";
import { TreeNodeKind } from "../tree-node/types/atoms";
import type { TreeAction } from "../tree-action/types/tree-action";
import type { WriteScrollStatusAction } from "../codex/types/codex-action";
import { computeScrollSplitPath } from "./compute-scroll-split-path";
import { extractNodeNameFromScrollSegmentId } from "./segment-id-helpers";

/**
 * Extract WriteScrollStatusAction from ChangeStatus actions on scrolls.
 */
export function extractScrollStatusActions(
	actions: TreeAction[],
	codecs: Codecs,
): WriteScrollStatusAction[] {
	const scrollActions: WriteScrollStatusAction[] = [];

	for (const action of actions) {
		if (
			action.actionType !== "ChangeStatus" ||
			action.targetLocator.targetKind !== TreeNodeKind.Scroll
		) {
			continue;
		}

		const nodeNameResult = extractNodeNameFromScrollSegmentId(
			action.targetLocator.segmentId as ScrollNodeSegmentId,
			codecs,
		);
		if (nodeNameResult.isErr()) {
			logger.error(
				"[Librarian] Failed to parse scroll segment ID:",
				nodeNameResult.error,
			);
			continue;
		}
		const nodeName = nodeNameResult.value;

		const parentChain = action.targetLocator.segmentIdChainToParent;
		const splitPathResult = computeScrollSplitPath(
			nodeName,
			parentChain,
			codecs,
		);
		if (splitPathResult.isErr()) {
			logger.error(
				"[Librarian] Failed to compute scroll split path:",
				splitPathResult.error,
			);
			continue;
		}
		const splitPath = splitPathResult.value;

		scrollActions.push({
			kind: "WriteScrollStatus",
			payload: {
				splitPath,
				status: action.newStatus,
			},
		});
	}

	return scrollActions;
}
