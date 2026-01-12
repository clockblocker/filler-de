import { err, ok, type Result } from "neverthrow";
import {
	type CodecError,
	makeSegmentIdError,
} from "../../../../../codecs/errors";
import type {
	SegmentIdCodecs,
	TreeNodeSegmentId,
} from "../../../../../codecs/segment-id";
import { TreeNodeKind, TreeNodeStatus } from "../../types/atoms";
import type { TreeNode } from "../../types/tree-node";

/**
 * TreeNode ↔ SegmentId adapter codecs.
 * Thin adapter that uses centralized segment-id codecs internally.
 */
export type TreeNodeCodecs = {
	/**
	 * Converts TreeNode to SegmentId using centralized codecs.
	 * Uses segmentId.serializeSegmentId internally.
	 */
	makeNodeSegmentId: (node: TreeNode) => TreeNodeSegmentId;

	/**
	 * Converts SegmentId to TreeNode using centralized codecs.
	 * Uses segmentId.parseSegmentId internally.
	 * Returns Result<TreeNode, CodecError> (neverthrow-pilled).
	 */
	makeTreeNode: (
		segmentId: TreeNodeSegmentId,
	) => Result<TreeNode, CodecError>;
};

/**
 * Creates TreeNode codecs that use centralized segment-id codecs.
 * Factory pattern for dependency injection.
 */
export function makeTreeNodeCodecs(segmentId: SegmentIdCodecs): TreeNodeCodecs {
	// Helper function for makeNodeSegmentId
	function makeNodeSegmentId(node: TreeNode): TreeNodeSegmentId {
		// Extract components from TreeNode with proper type narrowing
		switch (node.kind) {
			case TreeNodeKind.Section: {
				return segmentId.serializeSegmentId({
					coreName: node.nodeName,
					targetKind: TreeNodeKind.Section,
				});
			}
			case TreeNodeKind.Scroll: {
				return segmentId.serializeSegmentId({
					coreName: node.nodeName,
					extension: node.extension,
					targetKind: TreeNodeKind.Scroll,
				});
			}
			case TreeNodeKind.File: {
				return segmentId.serializeSegmentId({
					coreName: node.nodeName,
					extension: node.extension,
					targetKind: TreeNodeKind.File,
				});
			}
		}
	}

	// Helper function for makeTreeNode
	function makeTreeNode(
		segmentIdValue: TreeNodeSegmentId,
	): Result<TreeNode, CodecError> {
		// Use centralized codec to parse
		const parseResult = segmentId.parseSegmentId(segmentIdValue);

		if (parseResult.isErr()) {
			return err(parseResult.error);
		}

		const components = parseResult.value;

		// Construct TreeNode from components
		switch (components.targetKind) {
			case TreeNodeKind.Section: {
				return ok({
					children: {},
					kind: TreeNodeKind.Section,
					nodeName: components.coreName,
				});
			}

			case TreeNodeKind.Scroll: {
				return ok({
					extension: components.extension,
					kind: TreeNodeKind.Scroll,
					nodeName: components.coreName,
					status: TreeNodeStatus.Unknown,
				});
			}

			case TreeNodeKind.File: {
				return ok({
					extension: components.extension,
					kind: TreeNodeKind.File,
					nodeName: components.coreName,
					status: TreeNodeStatus.Unknown,
				});
			}

			default: {
				// TypeScript exhaustiveness check - should never happen if parseSegmentId is correct
				return err(
					makeSegmentIdError(
						"UnknownType",
						String(segmentIdValue),
						`Unknown TreeNodeKind: ${String(components.targetKind)}`,
						{ targetKind: components.targetKind },
					),
				);
			}
		}
	}

	return {
		makeNodeSegmentId,
		makeTreeNode,
	};
}
