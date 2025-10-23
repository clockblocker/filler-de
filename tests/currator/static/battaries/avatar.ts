import { type SerializedText } from '../../../../src/managers/librarian/types';

export const AVATAR_TEXTS = [
	{
		pageStatuses: ['NotStarted'] as const,
		path: ['Avatar', 'Season_1', 'Episode_1'] as const,
	},
	{
		pageStatuses: ['NotStarted', 'NotStarted'] as const,
		path: ['Avatar', 'Season_1', 'Episode_2'] as const,
	},
	{
		pageStatuses: ['NotStarted'] as const,
		path: ['Avatar', 'Season_2', 'Episode_1'] as const,
	},
	{
		pageStatuses: ['NotStarted'] as const,
		path: ['Avatar', 'Season_2', 'Episode_2'] as const,
	},
	{
		pageStatuses: ['NotStarted'] as const,
		path: ['Intro'] as const,
	},
] as const satisfies SerializedText[];
