import type { BulkVaultEvent } from "../../../../../../../../../managers/obsidian/vault-action-manager";
import type { CodecRules } from "../../../codecs/rules";
import type { LibraryScopedBulkVaultEvent } from "../types/scoped-event";
import { makeEventLibraryScoped } from "./events/make-event-libray-scoped";

/**
 * Converts a raw `BulkVaultEvent` into a **Library-scoped bulk**.
 *
 * What this does:
 * - Applies `makeEventLibraryScoped` to **every** event and root.
 * - Classifies each event by its relation to the Library:
 *   `Inside`, `Outside`, `InsideToOutside`, `OutsideToInside`.
 * - Normalizes all **inside** SplitPaths so they are safe to interpret
 *   as Library-relative (Library root preserved as a normal node).
 *
 * What this does *not* do:
 * - No collapsing, no deduplication, no semantic interpretation.
 * - No Tree actions, no canonicalization, no healing decisions.
 *
 * This establishes the invariant that all downstream logic
 * (`materializeScopedBulk`) can reason **purely in Library space**
 * and safely discard outside-world noise.
 */
export const makeLibraryScopedBulkVaultEvent = (
	bulk: BulkVaultEvent,
	rules: CodecRules,
): LibraryScopedBulkVaultEvent => ({
	...bulk,
	events: bulk.events.map((ev) => makeEventLibraryScoped(ev, rules)),
	roots: bulk.roots.map((ev) => makeEventLibraryScoped(ev, rules)),
});
