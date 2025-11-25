import { getTreePathFromNode } from "../../pure-functions/node";
import type { TextDto, TextNode, TreeNode, TreePath } from "../../types";
import { NodeType } from "../../types";
import { LibraryTree } from "../library-tree";

export const makeTreeFromTexts = (
	texts: TextDto[],
	treeName = "Library",
): LibraryTree => {
	const tree = new LibraryTree([], treeName);
	tree.addTexts(texts);
	return tree;
};

export const makeTextsFromTree = (tree: LibraryTree): TextDto[] => {
	const texts: TextDto[] = [];
	const stack: TreeNode[] = [tree.root];

	while (stack.length) {
		const node = stack.pop();
		if (!node) break;
		if (node.type === NodeType.Text) {
			texts.push(serializeTextNode(node));
		}
		if (node.type === NodeType.Section) {
			stack.push(...node.children);
		}
	}

	return texts;
};

export function serializeTextNode(node: TextNode): TextDto {
	const path = getTreePathFromNode(node);
	// Always use actual page names (works for both scrolls and books)
	const pageStatuses = Object.fromEntries(
		node.children.map(({ name, status }) => [name, status]),
	);

	return {
		pageStatuses,
		path,
	};
}
