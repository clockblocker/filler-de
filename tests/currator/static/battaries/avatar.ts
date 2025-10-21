import { type SerializedText } from '../../../../src/currator/currator-types';

export const AVATAR_TEXTS = [
	{
		path: ['Avatar', 'Season_1', 'Episode_1'] as const,
		pageStatuses: ['NotStarted'] as const,
	},
	{
		path: ['Avatar', 'Season_1', 'Episode_2'] as const,
		pageStatuses: ['NotStarted', 'NotStarted'] as const,
	},
	{
		path: ['Avatar', 'Season_2', 'Episode_1'] as const,
		pageStatuses: ['NotStarted'] as const,
	},
	{
		path: ['Avatar', 'Season_2', 'Episode_2'] as const,
		pageStatuses: ['NotStarted'] as const,
	},
	{
		path: ['Intro'] as const,
		pageStatuses: ['NotStarted'] as const,
	},
] as const satisfies SerializedText[];
