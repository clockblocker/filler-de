import type { Codecs } from "../../../../../codecs";
import type {
	NodeLocatorOf,
	TreeNodeLocator,
} from "../../../../../codecs/locator/types";
import { NodeSegmentIdSeparator } from "../../../../../codecs/segment-id/types/segment-id";
import {
	type NodeName,
	nodeNameSchema,
} from "../../../../../types/schemas/node-name";
import { TreeNodeKind } from "../../../tree-node/types/atoms";

/**
 * The node name in a locator's segment ID.
 *
 * Invariant: the locator comes from the locator codecs, which validate its
 * segment ID. One whose node name does not parse is a bug, and this throws.
 */
export const getNodeName = <NK extends TreeNodeKind>(
	locator: NodeLocatorOf<NK>,
	codecs: Codecs,
): NodeName => {
	const sep = NodeSegmentIdSeparator; // "──" (your const)
	const [raw] = locator.segmentId.split(sep, 1);

	// runtime safety; should always pass if locators are well-formed
	const r = nodeNameSchema(codecs.rules.suffixDelimiterPattern).safeParse(
		raw,
	);
	if (!r.success) {
		throw new Error(
			r.error.issues[0]?.message ?? "Invalid NodeName in locator",
		);
	}
	return r.data;
};

/**
 * The locator of a locator's parent section.
 *
 * Invariant: the locator is below the Library root. The root has no parent,
 * and the caller must handle it on its own; passing it is a bug, and this
 * throws.
 */
export const getParentLocator = (
	locator: TreeNodeLocator,
): NodeLocatorOf<"Section"> => {
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
		targetKind: TreeNodeKind.Section,
	};
};
