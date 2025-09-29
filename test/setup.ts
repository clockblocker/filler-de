import { vi } from 'vitest';

vi.mock('utils', () => {
	return {
		wrapTextInBacklinkBlock: ({
			text,
			linkId,
		}: {
			text: string;
			fileName: string;
			linkId: number;
		}) => `${linkId}:${text}`,
	};
});
