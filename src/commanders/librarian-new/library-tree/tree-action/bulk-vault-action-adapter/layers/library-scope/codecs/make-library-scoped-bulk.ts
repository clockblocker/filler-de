import type { BulkVaultEvent } from "../../../../../../../../obsidian-vault-action-manager";
import type { LibraryScopedBulkVaultEvent } from "../types/scoped-event";
import { makeEventLibraryScoped } from "./events/make-event-libray-scoped";

export const makeLibraryScopedBulkVaultEvent = (
	bulk: BulkVaultEvent,
): LibraryScopedBulkVaultEvent => ({
	...bulk,
	events: bulk.events.map(makeEventLibraryScoped),
	roots: bulk.roots.map(makeEventLibraryScoped),
});
