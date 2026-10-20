import type { VaultEvent } from "../../../../..";

export type BulkWindow<Ev = VaultEvent> = {
	allObsidianEvents: Ev[];
	debug: {
		startedAt: number;
		endedAt: number;
	};
};
