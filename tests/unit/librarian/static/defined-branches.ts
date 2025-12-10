import type { NoteDto } from '../../../../src/commanders/librarian/types';
import { AVATAR_NOTES } from './batteries/avatar';

type BranchName = 'Avatar';

// New format: flat NoteDto array
export const VALID_BRANCHES: Record<BranchName, { notes: NoteDto[] }> = {
	Avatar: {
		notes: AVATAR_NOTES,
	},
} as const;
