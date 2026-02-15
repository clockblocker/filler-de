import type { VaultEvent } from "../../../../..";

export type BulkWindow = {
	allObsidianEvents: VaultEvent[];
	debug: {
		startedAt: number;
		endedAt: number;
	};
};
