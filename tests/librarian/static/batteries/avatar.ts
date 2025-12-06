import { type NoteDto, type TextDto } from '../../../../src/commanders/librarian/types';

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

// Legacy format for backward compatibility during migration
export const AVATAR_TEXTS = [
	{
		// For ScrollNodes (single page), page name matches node name
		pageStatuses: { 'Episode_1': 'NotStarted' } as const,
		path: ['Avatar', 'Season_1', 'Episode_1'] as const,
	},
	{
		// For BookNodes (multiple pages), page names are preserved
		pageStatuses: { '000': 'NotStarted', '001': 'NotStarted' } as const,
		path: ['Avatar', 'Season_1', 'Episode_2'] as const,
	},
	{
		pageStatuses: { 'Episode_1': 'NotStarted' } as const,
		path: ['Avatar', 'Season_2', 'Episode_1'] as const,
	},
	{
		pageStatuses: { 'Episode_2': 'NotStarted' } as const,
		path: ['Avatar', 'Season_2', 'Episode_2'] as const,
	},
	{
		pageStatuses: { 'Intro': 'NotStarted' } as const,
		path: ['Intro'] as const,
	},
] as const satisfies TextDto[];
