import { type SerializedText } from '../../../../src/commanders/librarian/types';

export const AVATAR_TEXTS = [
	{
		// For ScrollNodes (single page), page name matches node name
		pageStatuses: { 'Episode_1': 'NotStarted' } as const,
		path: ['Avatar', 'Season_1', 'Episode_1'] as const,
	},
	{
		// For BookNodes (multiple pages), page names are preserved
		pageStatuses: { 'Page1': 'NotStarted', 'Page2': 'NotStarted' } as const,
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
] as const satisfies SerializedText[];
