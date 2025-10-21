import type { SerializedText } from '../../../src/managers/currator/currator-types';
import { AVATAR_TEXTS } from './battaries/avatar';

type BranchName = 'Avatar';

export const VALID_BRANCHES: Record<BranchName, { texts: SerializedText[] }> = {
	Avatar: {
		texts: AVATAR_TEXTS,
	},
} as const;
