import { type NoteDto } from '../../../../src/commanders/librarian/types';

// New format: flat NoteDto array (one entry per file)
export const AVATAR_NOTES = [
	// Season 1, Episode 1 (scroll - single note)
	{
		path: ['Avatar', 'Season_1', 'Episode_1'] as const,
		status: 'NotStarted',
	},
	// Season 1, Episode 2 (book - 2 pages = 2 notes under Section)
	{
		path: ['Avatar', 'Season_1', 'Episode_2', '000'] as const,
		status: 'NotStarted',
	},
	{
		path: ['Avatar', 'Season_1', 'Episode_2', '001'] as const,
		status: 'NotStarted',
	},
	// Season 2
	{
		path: ['Avatar', 'Season_2', 'Episode_1'] as const,
		status: 'NotStarted',
	},
	{
		path: ['Avatar', 'Season_2', 'Episode_2'] as const,
		status: 'NotStarted',
	},
	// Root-level scroll
	{
		path: ['Intro'] as const,
		status: 'NotStarted',
	},
] as const satisfies NoteDto[];
