import { type BranchNode, NodeType, type TreeNode } from "../../types";

export function* bfs(
	root: BranchNode,
): Generator<{ node: TreeNode; path: string[] }> {
	const queue: { node: any; path: string[] }[] = [];
	for (const child of root.children) {
		queue.push({ node: child, path: [child.name.toString()] });
	}

	while (queue.length) {
		const { node, path } = queue.shift()!;
		if ("type" in node && node.type === NodeType.Text) {
			yield { node, path };
			for (const page of node.children) {
				yield { node: page, path: [...path, page.name.toString()] };
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
): Generator<{ node: TreeNode; path: string[] }> {
	function* traverse(node: TreeNode, path: string[]) {
		if ("type" in node && node.type === NodeType.Text) {
			yield { node, path };
			for (const page of node.children) {
				yield { node: page, path: [...path, page.name.toString()] };
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
