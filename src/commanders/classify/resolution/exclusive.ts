/**
 * One plan-and-commit at a time per dictionary store. The store's revision
 * is global and it plans nothing itself, so every plan built while another
 * commit waits would go stale; serializing plan and commit leaves only
 * edits made outside the plugin to conflict.
 */
import { type Effect, Semaphore } from "effect";

const locks = new WeakMap<object, Semaphore.Semaphore>();

export function exclusive(store: object) {
	let lock = locks.get(store);
	if (!lock) {
		lock = Semaphore.makeUnsafe(1);
		locks.set(store, lock);
	}
	const held = lock;
	return <A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, E, R> =>
		held.withPermit(effect);
}
