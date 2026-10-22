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
 * One raw callback as observation carries it: its place in the sequence and
 * the event it became. Per-callback labels belong here beside `seq`: a
 * later `origin`, and the `operationId` of the dispatch that caused it,
 * which become span attributes. Cursor filtering reads only `seq`.
 */
export type ObservedCallback<Ev> = {
	readonly event: Ev;
	readonly seq: number;
};
