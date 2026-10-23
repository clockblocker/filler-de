import type { Tracer } from "effect";
import {
	EXTERNAL_ORIGIN,
	type VaultEventOrigin,
} from "../../types/event-origin";

/**
 * Numbers every raw Obsidian vault callback VAM listens to (create, rename,
 * delete, modify) in the order Obsidian fired them. One sequence spans both
 * observation channels, so a cursor read from it divides every callback
 * into before and after.
 *
 * Callbacks are numbered on entry, before Self Event attribution, so a
 * number names a callback and not what VAM later made of it.
 */
export class VaultCallbackSequence {
	private last = 0;

	/** The number of the latest callback; 0 before the first. */
	get current(): number {
		return this.last;
	}

	/** Numbers the callback Obsidian is firing now. */
	next(): number {
		this.last += 1;
		return this.last;
	}
}

/**
 * Who caused one callback, and, when a Dispatch Batch did (a `Vam` or a
 * `LinkUpdate` origin), the span that batch ran under, so the callback's
 * delivery can link to it.
 */
export type Attribution = {
	readonly dispatchSpan: Tracer.AnySpan | undefined;
	readonly origin: VaultEventOrigin;
};

/** A callback no Dispatch Batch caused. */
export const EXTERNAL_ATTRIBUTION: Attribution = {
	dispatchSpan: undefined,
	origin: EXTERNAL_ORIGIN,
};

/**
 * One raw callback as observation carries it: its place in the sequence,
 * the event it became, who caused it, and the span of the Dispatch Batch
 * that did. Cursor filtering reads `seq`; each subscription's origin filter
 * reads `origin`; a delivery links to the `dispatchSpan` of each callback
 * it delivers.
 */
export type ObservedCallback<Ev> = Attribution & {
	readonly event: Ev;
	readonly seq: number;
};
