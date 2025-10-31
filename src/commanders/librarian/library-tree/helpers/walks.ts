import {
	type BranchNode,
	NodeType,
	type TreeNode,
	type TreePath,
} from "../../types";

export function* bfs(
	root: BranchNode,
): Generator<{ node: TreeNode; path: TreePath }> {
	const queue: { node: TreeNode; path: TreePath }[] = [];
	for (const child of root.children) {
		queue.push({ node: child, path: [child.name.toString()] });
	}

	while (queue.length) {
		const item = queue.shift();
		if (!item) break;
		const { node, path } = item;
		if (
			"type" in node &&
			(node.type === NodeType.Book || node.type === NodeType.Scroll)
		) {
			yield { node, path };
			if (node.type === NodeType.Book) {
				for (const page of node.children) {
					yield { node: page, path: [...path, page.name.toString()] };
				}
			}
		} else if ("type" in node && node.type === NodeType.Section) {
			yield { node, path };
			for (const child of node.children) {
				queue.push({ node: child, path: [...path, child.name] });
			}
		}
	}
}

export function* dfs(
	root: BranchNode,
): Generator<{ node: TreeNode; path: TreePath }> {
	function* traverse(node: TreeNode, path: TreePath) {
		if (
			"type" in node &&
			(node.type === NodeType.Book || node.type === NodeType.Scroll)
		) {
			yield { node, path };
			if (node.type === NodeType.Book) {
				for (const page of node.children) {
					yield { node: page, path: [...path, page.name.toString()] };
				}
			}
		} else if ("type" in node && node.type === NodeType.Section) {
			yield { node, path };
			for (const child of node.children) {
				yield* traverse(child, [...path, child.name]);
			}
		}
	}

	for (const child of root.children) {
		yield* traverse(child, [child.name.toString()]);
	}
}
