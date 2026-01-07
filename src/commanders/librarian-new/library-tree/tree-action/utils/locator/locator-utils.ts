import {
	type NodeName,
	NodeNameSchema,
} from "../../../../types/schemas/node-name";
import { TreeNodeType } from "../../../tree-node/types/atoms";
import { NodeSegmentIdSeparator } from "../../../tree-node/types/node-segment-id";
import type {
	SectionNodeLocator,
	TreeNodeLocator,
} from "../../types/target-chains";

export const getNodeName = (locator: TreeNodeLocator): NodeName => {
	const sep = NodeSegmentIdSeparator; // "──" (your const)
	const [raw] = locator.segmentId.split(sep, 1);

	// runtime safety; should always pass if locators are well-formed
	const r = NodeNameSchema.safeParse(raw);
	if (!r.success) {
		throw new Error(
			r.error.issues[0]?.message ?? "Invalid NodeName in locator",
		);
	}
	return r.data;
};

export const getParentLocator = (
	locator: TreeNodeLocator,
): SectionNodeLocator => {
	const chain = locator.segmentIdChainToParent;
	const parentSegmentId = chain.at(-1);

	if (!parentSegmentId) {
		throw new Error(
			"Locator has no parent (root). Handle Library root separately.",
		);
	}

	return {
		segmentId: parentSegmentId,
		segmentIdChainToParent: chain.slice(0, -1),
		targetType: TreeNodeType.Section,
	};
};
