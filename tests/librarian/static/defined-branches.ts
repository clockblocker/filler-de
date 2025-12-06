import type { NoteDto, TextDto } from '../../../src/commanders/librarian/types';
import { AVATAR_NOTES, AVATAR_TEXTS } from './batteries/avatar';

type BranchName = 'Avatar';

// New format: flat NoteDto array
export const VALID_BRANCHES_V2: Record<BranchName, { notes: NoteDto[] }> = {
	Avatar: {
		notes: AVATAR_NOTES,
	},
} as const;

// Legacy format for backward compatibility
export const VALID_BRANCHES: Record<BranchName, { texts: TextDto[] }> = {
	Avatar: {
		texts: AVATAR_TEXTS,
	},
} as const;
