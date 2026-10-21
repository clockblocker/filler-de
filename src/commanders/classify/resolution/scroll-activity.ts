/**
 * Which Scrolls a Classify run is resolving in (#116). A run commits its
 * occurrences before it writes their links, so until it ends a Scroll can
 * hold refs whose links are not there yet, and the editor saves the links
 * it wrote a moment after it ends. The unlink observer leaves a busy Scroll
 * alone, and looks again a quiet period after its last run ended.
 */
export type ScrollActivity = {
	/** Marks a run on the Scroll at `path`; call what it returns when the run ends. */
	readonly begin: (path: string) => () => void;
	readonly busy: (path: string) => boolean;
	/** Resolves once no run is going on the Scroll at `path`. */
	readonly idle: (path: string) => Promise<void>;
	/** When the last run on the Scroll at `path` ended, by `Date.now()`, if one did. */
	readonly endedAt: (path: string) => number | undefined;
};

export function createScrollActivity(): ScrollActivity {
	const runs = new Map<string, number>();
	const ended = new Map<string, number>();
	const waiters = new Map<string, (() => void)[]>();
	return {
		begin: (path) => {
			runs.set(path, (runs.get(path) ?? 0) + 1);
			let done = false;
			return () => {
				if (done) return;
				done = true;
				ended.set(path, Date.now());
				const left = (runs.get(path) ?? 1) - 1;
				if (left > 0) {
					runs.set(path, left);
					return;
				}
				runs.delete(path);
				const waiting = waiters.get(path) ?? [];
				waiters.delete(path);
				for (const resolve of waiting) resolve();
			};
		},
		busy: (path) => runs.has(path),
		endedAt: (path) => ended.get(path),
		idle: (path) =>
			runs.has(path)
				? new Promise<void>((resolve) => {
						waiters.set(path, [
							...(waiters.get(path) ?? []),
							resolve,
						]);
					})
				: Promise.resolve(),
	};
}
