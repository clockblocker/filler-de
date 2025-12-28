
const treeNodeToCodexLine = z.codec(
	TreeNodeSchema,
	CodexLineSchema,
	{
		decode: 
		encode: 
	},
);

export const tryExtractTreeNodeFromCodexLine = (backlink: string): Result<TreeNode> => {
	
export const makeCodexLineFromTreeNode = (node: TreeNode) => CodexLine