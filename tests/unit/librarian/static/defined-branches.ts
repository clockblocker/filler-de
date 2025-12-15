import type { NoteDtoLegacy } from '../../../../src/commanders/librarian/types';
import { AVATAR_NOTES } from './batteries/avatar';

type BranchName = 'Avatar';

// New format: flat NoteDtoLegacy array
export const VALID_BRANCHES: Record<BranchName, { notes: NoteDtoLegacy[] }> = {
	Avatar: {
		notes: AVATAR_NOTES,
	},
} as const;
