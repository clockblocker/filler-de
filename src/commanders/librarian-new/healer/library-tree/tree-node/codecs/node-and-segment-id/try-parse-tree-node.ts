import { err, ok, type Result } from "neverthrow";
import { TreeNodeSegmentIdSchema } from "../../types/node-segment-id";
import type { TreeNode } from "../../types/tree-node";
import { makeTreeNode } from "./optimistic-makers/make-tree-node";

export function tryParseTreeNode(
	dirtySegmentId: string,
): Result<TreeNode, string> {
	const parsed = TreeNodeSegmentIdSchema.safeParse(dirtySegmentId);

	if (!parsed.success) {
		return err(parsed.error.message);
	}
	const node = makeTreeNode(parsed.data);
	return ok(node);
}
