import { err, ok, type Result } from "neverthrow";
import type { CodecError } from "../../../../../codecs/errors";
import { makeZodError } from "../../../../../codecs/errors";
import { TreeNodeSegmentIdSchema } from "../../../../../../codecs/segment-id/types/segment-id";
import type { TreeNode } from "../../types/tree-node";
import type { TreeNodeCodecs } from "./tree-node-segment-id-codec";

/**
 * Parses a potentially invalid segment ID string to TreeNode.
 * Uses TreeNodeCodecs adapter internally.
 * Returns Result<TreeNode, CodecError> (neverthrow-pilled).
 */
export function tryParseTreeNode(
	treeNodeCodecs: TreeNodeCodecs,
	dirtySegmentId: string,
): Result<TreeNode, CodecError> {
	const parsed = TreeNodeSegmentIdSchema.safeParse(dirtySegmentId);

	if (!parsed.success) {
		// Convert Zod error to CodecError
		return err(
			makeZodError(parsed.error.issues, parsed.error.message, {
				raw: dirtySegmentId,
			}),
		);
	}

	// Use adapter's makeTreeNode (returns Result<TreeNode, CodecError>)
	return treeNodeCodecs.makeTreeNode(parsed.data);
}
