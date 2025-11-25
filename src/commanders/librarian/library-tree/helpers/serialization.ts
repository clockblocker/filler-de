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
			const s = serializeTextNode(node);
			console.log(
				"[makeTextsFromTree] Text node",
				node.name,
				node.children,
				s,
			);
			texts.push(s);
		}
		if (node.type === NodeType.Section) {
			stack.push(...node.children);
		}
	}

	return texts;
};

export function serializeTextNode(node: TextNode): TextDto {
	const path = getTreePathFromNode(node);
	const pages = node.children;
	const pageStatuses =
		pages.length === 1
			? { [node.name]: node.status }
			: Object.fromEntries(
					node.children.map(({ name, status }) => [name, status]),
				);

	return {
		pageStatuses,
		path,
	};
}
