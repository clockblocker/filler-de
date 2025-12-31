import type { BulkVaultEvent } from "../../../../../../../obsidian-vault-action-manager";
import { makeLibraryScopedVaultEvent } from "./make-library-scoped-vault-event";
import type { LibraryScopedBulkVaultEvent } from "./types";

export const makeLibraryScopedBulkVaultEvent = (
	bulk: BulkVaultEvent,
): LibraryScopedBulkVaultEvent => ({
	...bulk,
	events: bulk.events.map(makeLibraryScopedVaultEvent),
	roots: bulk.roots.map(makeLibraryScopedVaultEvent),
});
