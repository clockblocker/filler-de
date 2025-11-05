import {
	type LibraryFile,
	NodeType,
	type TreeNode,
	type TreePath,
} from "../types";

const haveSameType = (node1: TreeNode, node2: TreeNode) => {
	return node1.type === node2.type;
};

const haveSameStatus = (node1: TreeNode, node2: TreeNode) => {
	return node1.type === node2.type;
};

export const areShallowEqual = (node1: TreeNode, node2: TreeNode) => {
	if (!(haveSameType(node1, node2) && haveSameStatus(node1, node2))) {
		return false;
	}

	return node1.name === node2.name;
};

export const computeNodePath = (node: TreeNode): TreePath => {
	let current = node;
	const path: string[] = [];

	while (current.parent) {
		path.push(current.name);
		current = current.parent;
	}

	return path.reverse() as TreePath;
};

export const getNodeId = (node: TreeNode): string => {
	return [...computeNodePath(node), node.type].join("-");
};
