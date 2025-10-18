import type {
	TreeNode,
	SerializedText,
} from '../../../src/currator/tree-types';
import { AVATAR_NODES, AVATAR_TEXTS } from './battaries/avatar';

type BranchName = 'Avatar';

export const DEFINED_BRANCHES: Record<
	BranchName,
	{ nodes: TreeNode[]; texts: SerializedText[] }
> = {
	Avatar: {
		nodes: AVATAR_NODES,
		texts: AVATAR_TEXTS,
	},
} as const;
