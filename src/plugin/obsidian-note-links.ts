/**
 * Obsidian's link index as the Reading lifetime reads it (#281): every
 * file's resolved links, when the metadata cache has resolved them all,
 * and each file it resolved again, deleted or renamed.
 */
import { Effect, Queue, Stream } from "effect";
import type { App, MetadataCache, TAbstractFile, TFile } from "obsidian";
import type {
	LinkChange,
	NoteLinks,
} from "../commanders/classify/resolution/reading-lifetime";

/** What the metadata cache holds beyond its typings, in Obsidian 1.x. */
type CleanCache = MetadataCache & {
	/** Set once the first index of the vault has been read. */
	readonly initialized?: boolean;
	/**
	 * Calls back once no file is being parsed and none waits for its
	 * links to be resolved: at once when none does.
	 */
	readonly onCleanCache?: (callback: () => void) => void;
};

/** The next `resolved`, which Obsidian fires once its link queue runs dry. */
const nextResolved = (cache: MetadataCache) =>
	Effect.callback<void>((resume) => {
		const ref = cache.on("resolved", () => {
			cache.offref(ref);
			resume(Effect.void);
		});
		return Effect.sync(() => cache.offref(ref));
	});

/**
 * Ends once Obsidian has resolved the links of every file it is indexing.
 * Without `onCleanCache`, or before the first index, it waits for the next
 * `resolved`, which may be late, but is never early.
 */
const settled = (cache: CleanCache) =>
	Effect.suspend(() => {
		const { onCleanCache } = cache;
		if (cache.initialized !== true || typeof onCleanCache !== "function")
			return nextResolved(cache);
		return Effect.callback<void>((resume) => {
			// Obsidian keeps no handle to unregister this; a late call after
			// an interruption resumes nothing.
			onCleanCache.call(cache, () => resume(Effect.void));
		}).pipe(Effect.catchDefect(() => nextResolved(cache)));
	});

export type ObsidianNoteLinks = NoteLinks & {
	/** Each file Obsidian resolved again, deleted or renamed, while it is run. */
	readonly changes: Stream.Stream<LinkChange>;
};

export const obsidianNoteLinks = (
	app: Pick<App, "metadataCache" | "vault">,
): ObsidianNoteLinks => {
	const cache = app.metadataCache as CleanCache;
	return {
		changes: Stream.callback<LinkChange>((queue) =>
			Effect.acquireRelease(
				Effect.sync(() => {
					const emit = (change: LinkChange) => {
						Queue.offerUnsafe(queue, change);
					};
					return [
						cache.on("resolve", (file: TFile) =>
							emit({ _tag: "Resolved", path: file.path }),
						),
						app.vault.on("delete", (file: TAbstractFile) =>
							emit({ _tag: "Deleted", path: file.path }),
						),
						app.vault.on(
							"rename",
							(file: TAbstractFile, oldPath: string) =>
								emit({
									_tag: "Renamed",
									from: oldPath,
									to: file.path,
								}),
						),
					] as const;
				}),
				([resolve, deleted, renamed]) =>
					Effect.sync(() => {
						cache.offref(resolve);
						app.vault.offref(deleted);
						app.vault.offref(renamed);
					}),
			),
		),
		resolvedLinks: () => cache.resolvedLinks,
		settled: settled(cache),
	};
};
