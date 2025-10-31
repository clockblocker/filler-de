import type { TextDto } from '../../../src/commanders/librarian/types';
import { AVATAR_TEXTS } from './battaries/avatar';

type BranchName = 'Avatar';

export const VALID_BRANCHES: Record<BranchName, { texts: TextDto[] }> = {
	Avatar: {
		texts: AVATAR_TEXTS,
	},
} as const;
