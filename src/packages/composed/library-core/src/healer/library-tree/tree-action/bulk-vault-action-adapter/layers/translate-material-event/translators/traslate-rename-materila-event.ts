import type { Codecs } from "../../../../../../../codecs";
import { TreeNodeKind } from "../../../../../tree-node/types/atoms";
import {
	type LibraryIssue,
	libraryWarning,
} from "../../../../../types/library-issue";
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
import { inferPolicyAndIntent } from "../policy-and-intent/infer-policy-and-intent";
import { RenameIntent } from "../policy-and-intent/intent/types";
import { tryMakeDestinationLocatorFromEvent } from "./helpers/event-to-locator";
import { tryMakeTargetLocatorFromLibraryScopedSplitPath } from "./helpers/split-path-to-locator";

export type RenameTranslation = {
	readonly actions: Array<RenameNodeAction | MoveNodeAction>;
	/** Why the rename was not translated, when it was not. */
	readonly issues: readonly LibraryIssue[];
};

export function traslateRenameMaterializedEvent(
	ev: RenameTreeNodeNodeMaterializedEvent,
	codecs: Codecs,
): RenameTranslation {
	const out: Array<RenameNodeAction | MoveNodeAction> = [];

	const { intent } = inferPolicyAndIntent(ev, codecs);

	// 1) target = current node location in tree (FROM)
	const targetRes = tryMakeTargetLocatorFromLibraryScopedSplitPath(
		ev.from,
		codecs,
	);
	if (targetRes.isErr()) {
		return {
			actions: out,
			issues: [
				libraryWarning(
					"[translateRename] targetRes error:",
					targetRes.error,
				),
			],
		};
	}
	const targetLocator = targetRes.value;

	// 2) destination canonical (TO + policy/intent)
	const destinationRes = tryMakeDestinationLocatorFromEvent(ev, codecs);
	if (destinationRes.isErr()) {
		return {
			actions: out,
			issues: [
				libraryWarning(
					"[translateRename] destinationRes error:",
					destinationRes.error,
				),
			],
		};
	}
	const destinationLocator = destinationRes.value;

	const newNodeName = getNodeName(destinationLocator, codecs);
	const newParentLocator = getParentLocator(destinationLocator);

	if (intent === RenameIntent.Rename) {
		out.push({
			actionType: TreeActionType.Rename,
			newNodeName,
			...(targetLocator.targetKind === TreeNodeKind.Section
				? {}
				: { observedSplitPath: ev.to }),
			targetLocator,
		} as RenameNodeAction);
		return { actions: out, issues: [] };
	}

	out.push({
		actionType: TreeActionType.Move,
		newNodeName,
		newParentLocator,
		observedSplitPath: ev.to, // observed after user op
		targetLocator,
	} as MoveNodeAction);

	return { actions: out, issues: [] };
}
