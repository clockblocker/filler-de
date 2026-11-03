/**
 * Obsidian's link index as the Reading lifetime reads it (#281, #290):
 * every file's resolved and unresolved links, every canvas's links, when
 * the metadata cache has resolved them all, and each file it resolved
 * again, deleted or renamed.
 */
import { Effect, Option, Predicate, Queue, Stream } from "effect";
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

/** A wikilink or embed's link path: what stands before its `#` and `|`. */
const WIKILINK = /!?\[\[([^\]|#\n]*)(?:#[^\]|\n]*)?(?:\|[^\]\n]*)?\]\]/gu;

const parseJson = Option.liftThrowable((raw: string): unknown =>
	JSON.parse(raw),
);

/** A canvas's cards' links, each as written: text cards' wikilinks, file cards' files. */
const canvasTargets = (raw: string) => {
	const links: { readonly linkpath: string; readonly file: boolean }[] = [];
	const json = Option.getOrUndefined(parseJson(raw));
	const nodes =
		Predicate.hasProperty(json, "nodes") && Array.isArray(json.nodes)
			? (json.nodes as unknown[])
			: [];
	for (const node of nodes) {
		if (!Predicate.hasProperty(node, "type")) continue;
		if (
			node.type === "file" &&
			Predicate.hasProperty(node, "file") &&
			Predicate.isString(node.file)
		)
			links.push({ file: true, linkpath: node.file });
		if (
			node.type === "text" &&
			Predicate.hasProperty(node, "text") &&
			Predicate.isString(node.text)
		)
			for (const match of node.text.matchAll(WIKILINK))
				if (match[1]) links.push({ file: false, linkpath: match[1] });
	}
	return links;
};

/** Every canvas's links, resolved as Obsidian opens them from it. A canvas that cannot be read links nothing. */
const canvasLinks = (app: Pick<App, "metadataCache" | "vault">) =>
	Effect.forEach(
		app.vault.getFiles().filter((file) => file.extension === "canvas"),
		(canvas) =>
			Effect.tryPromise(() => app.vault.cachedRead(canvas)).pipe(
				Effect.map((raw) => {
					const targets: Record<string, number> = {};
					for (const { file, linkpath } of canvasTargets(raw)) {
						const target = file
							? app.vault.getAbstractFileByPath(linkpath)?.path
							: app.metadataCache.getFirstLinkpathDest(
									linkpath,
									canvas.path,
								)?.path;
						if (target !== undefined)
							targets[target] = (targets[target] ?? 0) + 1;
					}
					return [canvas.path, targets] as const;
				}),
				Effect.orElseSucceed(() => [canvas.path, {}] as const),
			),
	).pipe(Effect.map((entries) => Object.fromEntries(entries)));

export const obsidianNoteLinks = (
	app: Pick<App, "metadataCache" | "vault">,
): ObsidianNoteLinks => {
	const cache = app.metadataCache as CleanCache;
	return {
		canvasLinks: canvasLinks(app),
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
		unresolvedLinks: () => cache.unresolvedLinks,
	};
};

const DEVICE_KEY = "textfresser-device-id";

/**
 * This device's ID for this vault, kept in Obsidian's local storage, which
 * no Sync carries: made once, on first use.
 */
export const deviceId = (
	app: Pick<App, "loadLocalStorage" | "saveLocalStorage">,
) => {
	const stored: unknown = app.loadLocalStorage(DEVICE_KEY);
	if (Predicate.isString(stored) && /^[\w-]+$/u.test(stored)) return stored;
	const made = crypto.randomUUID();
	app.saveLocalStorage(DEVICE_KEY, made);
	return made;
};
