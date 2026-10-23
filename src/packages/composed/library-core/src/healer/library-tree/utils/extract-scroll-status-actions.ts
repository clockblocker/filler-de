import { Result } from "effect";
import type { Codecs } from "../../../codecs";
import type { ScrollNodeSegmentId } from "../../../codecs/segment-id/types/segment-id";
import type { WriteScrollStatusAction } from "../codex/types/codex-action";
import type { TreeAction } from "../tree-action/types/tree-action";
import { TreeNodeKind } from "../tree-node/types/atoms";
import { type LibraryIssue, libraryError } from "../types/library-issue";
import { computeScrollSplitPath } from "./compute-scroll-split-path";
import { extractNodeNameFromScrollSegmentId } from "./segment-id-helpers";

/**
 * Extract WriteScrollStatusAction from ChangeStatus actions on scrolls,
 * with the scrolls it skipped, for the caller to log.
 */
export function extractScrollStatusActions(
	actions: TreeAction[],
	codecs: Codecs,
): {
	readonly actions: WriteScrollStatusAction[];
	readonly issues: readonly LibraryIssue[];
} {
	const scrollActions: WriteScrollStatusAction[] = [];
	const issues: LibraryIssue[] = [];

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
		if (Result.isFailure(nodeNameResult)) {
			issues.push(
				libraryError(
					"[Librarian] Failed to parse scroll segment ID:",
					nodeNameResult.failure,
				),
			);
			continue;
		}
		const nodeName = nodeNameResult.success;

		const parentChain = action.targetLocator.segmentIdChainToParent;
		const splitPathResult = computeScrollSplitPath(
			nodeName,
			parentChain,
			codecs,
		);
		if (Result.isFailure(splitPathResult)) {
			issues.push(
				libraryError(
					"[Librarian] Failed to compute scroll split path:",
					splitPathResult.failure,
				),
			);
			continue;
		}
		const splitPath = splitPathResult.success;

		scrollActions.push({
			kind: "WriteScrollStatus",
			payload: {
				splitPath,
				status: action.newStatus,
			},
		});
	}

	return { actions: scrollActions, issues };
}
