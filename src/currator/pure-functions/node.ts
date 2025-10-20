import {
	NodeType,
	type PageNode,
	type SectionNode,
	type TextNode,
	type TreeNode,
} from '../currator-types';

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

	switch (node1.type) {
		case NodeType.Page:
			return node1.index === (node2 as PageNode).index;
		case NodeType.Text:
			return node1.name === (node2 as TextNode).name;
		case NodeType.Section:
			return node1.name === (node2 as SectionNode).name;
	}
};
