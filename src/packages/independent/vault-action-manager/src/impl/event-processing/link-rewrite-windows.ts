import { Clock, Effect, Ref } from "effect";
import { type VaultAction, VaultActionKind } from "../../types/vault-action";

/**
 * How long after a link-updating rename a file's mtime still attributes its
 * modification to that rename. Obsidian rewrites links while
 * `FileManager.renameFile` runs; the grace covers writes that land just
 * after it resolves.
 */
export const LINK_REWRITE_GRACE_MS = 5000;

/**
 * Slack before a rename starts, for file systems whose mtime is coarser than
 * the clock.
 */
const MTIME_SLACK_MS = 1000;

/**
 * How long a finished window is kept. Modifications reach subscribers only
 * after their observation window closes, so a window must outlive its grace.
 */
const RETENTION_MS = 60_000;

type Window = {
	readonly start: number;
	/** `undefined` while the rename is still running. */
	readonly end: number | undefined;
};

/** Whether executing `action` lets Obsidian rewrite links in other files. */
export function rewritesLinks(action: VaultAction): boolean {
	switch (action.kind) {
		case VaultActionKind.RenameFolder:
		case VaultActionKind.RenameMdFile:
			return action.payload.updateLinks !== false;
		case VaultActionKind.RenameFile:
			return true;
		default:
			return false;
	}
}

/**
 * Remembers when VAM ran renames that let Obsidian rewrite links, so a
 * modification observed afterwards can be attributed to that rewriting by
 * its file's mtime.
 */
export class LinkRewriteWindows {
	private readonly windows = Ref.makeUnsafe<readonly Window[]>([]);

	constructor(private readonly graceMs: number = LINK_REWRITE_GRACE_MS) {}

	/** Runs `effect`, a link-updating rename, inside a recorded window. */
	track<A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, E, R> {
		return Effect.acquireUseRelease(
			Clock.currentTimeMillis.pipe(
				Effect.flatMap((start) => {
					const window: Window = { end: undefined, start };
					return Ref.update(this.windows, (windows) => [
						...this.prune(windows, start),
						window,
					]).pipe(Effect.as(window));
				}),
			),
			() => effect,
			(window) =>
				Clock.currentTimeMillis.pipe(
					Effect.flatMap((end) =>
						Ref.update(this.windows, (windows) =>
							windows.map((each) =>
								each === window ? { ...each, end } : each,
							),
						),
					),
				),
		);
	}

	/** Whether a write at `mtime` falls within a recorded window. */
	covers(mtime: number): Effect.Effect<boolean> {
		return Clock.currentTimeMillis.pipe(
			Effect.flatMap((now) =>
				Ref.modify(this.windows, (windows) => {
					const live = this.prune(windows, now);
					const covered = live.some(
						({ end, start }) =>
							mtime >= start - MTIME_SLACK_MS &&
							mtime <= (end ?? now) + this.graceMs,
					);
					return [covered, live];
				}),
			),
		);
	}

	private prune(windows: readonly Window[], now: number): readonly Window[] {
		return windows.filter(
			({ end }) =>
				end === undefined || end + this.graceMs + RETENTION_MS >= now,
		);
	}
}
