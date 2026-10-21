/**
 * Removing a link from a Scroll removes its occurrence (#116).
 *
 * VAM reports every Markdown modification it did not make
 * (`subscribeToMdModifications`): hand edits, Sync, Obsidian's link
 * rewriting. For a modified Scroll whose blocks the dictionary holds
 * Attestation Links into, the observer waits until the Scroll has been
 * quiet for `quietMs`, then reads it as it is and asks `unlinkedOccurrences`
 * which recorded occurrences it no longer links. Each of those goes through
 * `removeOccurrence` and its cascade: a Reading left with no link is
 * removed, a Surface is forgotten unless it holds user text, a Lemma with
 * no Reading is removed unless its kept Surfaces hold user text. After a
 * plan that removed Lemmas lands, the store re-evaluates their Shadows as a
 * commit of its own, from a slice it loads then (texteater#1257).
 *
 * What keeps a removal from being false:
 *
 * - **Quiet period.** Obsidian saves an editor about two seconds after the
 *   last keystroke, so a half-typed edit can reach disk; nothing is judged
 *   until the Scroll has had no modification for `quietMs`, and the Scroll
 *   is read again then.
 * - **Classify runs.** A run commits occurrences before it writes their
 *   links. A Scroll a run is resolving in is left alone until a quiet
 *   period after it ended, and the whole check and its removals hold the
 *   same lock as Classify's commits (`exclusive`), so no run commits in
 *   between.
 * - **The ref's Scroll.** Refs name a Scroll by basename; they count only
 *   when Obsidian resolves that basename, from their Reading note, to the
 *   modified file.
 * - **Ambiguity.** `unlinkedOccurrences` leaves alone whatever moved text,
 *   a lost block ID or a link in flux could explain.
 */
import type { DumdictVaultStore } from "@textfresser/dictionary";
import { parseNotePath } from "@textfresser/lemma-note-codec";
import { Effect, Option } from "effect";
import { getErrorMessage } from "../../../utils/get-error-message";
import { logger } from "../../../utils/logger";
import { scrollSentences, segmentSourceRanges } from "../scroll-sentences";
import type { SegmentationCache } from "../segmentation-cache";
import {
	sentenceInstances,
	sentenceKey,
	sentenceStitchedText,
} from "../sentence-key";
import { MAX_COMMIT_ATTEMPTS, removeOccurrence } from "./commit-occurrence";
import { exclusive } from "./exclusive";
import type { ScrollActivity } from "./scroll-activity";
import {
	attestationRefPrefixOf,
	occurrenceKeyOf,
	parseAttestationRef,
	scrollBasenameOf,
} from "./scroll-links";
import {
	dictionaryLinksOf,
	linkKeyOf,
	type RecordedOccurrence,
	type ScrollLink,
	unlinkedOccurrences,
} from "./scroll-unlinks";

/** How long a Scroll stays unmodified before its links are checked. */
const UNLINK_QUIET_MS = 5_000;

/** The part of the dictionary store the observer reads and removes through. */
export type UnlinkStore = Pick<
	DumdictVaultStore,
	| "attestationLinksWithRefPrefix"
	| "commitChanges"
	| "loadOccurrenceSlice"
	| "readingLocation"
>;

/** The Scrolls the observer reads, and how Obsidian resolves a ref's Scroll. */
export type UnlinkScrolls = {
	/** The Scroll's content as the editor or the vault holds it; none when it is gone. */
	readonly read: (path: string) => Effect.Effect<string | undefined>;
	readonly exists: (path: string) => Effect.Effect<boolean>;
	/** The file Obsidian opens for `linkpath` from `sourcePath`, if any. */
	readonly resolve: (
		linkpath: string,
		sourcePath: string,
	) => Effect.Effect<string | undefined>;
};

export type UnlinkObserverDeps = {
	readonly store: Effect.Effect<UnlinkStore, unknown>;
	readonly scrolls: UnlinkScrolls;
	readonly cache: SegmentationCache["Service"];
	readonly segmenterVersion: () => string;
	readonly activity: ScrollActivity;
	/** Why no occurrence may be removed now, such as a dictionary reset. */
	readonly blockedBy?: () => string | undefined;
	readonly notify?: (message: string) => void;
	readonly quietMs?: number;
	/** Called as a check is pending and once it is done, for the plugin's idle tracker. */
	readonly onStart?: () => void;
	readonly onEnd?: () => void;
};

export type UnlinkObserver = {
	/** Tells the observer these Markdown files changed. */
	readonly modified: (paths: readonly string[]) => void;
	/** Resolves once no check is pending. */
	readonly whenIdle: () => Promise<void>;
	/** Drops every pending check and takes no new one: the plugin unloads. */
	readonly close: () => void;
};

/**
 * Each link's occurrence key, recomputed as Classify computed it: from its
 * Sentence's cached segmentation, the unit its Segments belong to and the
 * instance of the Sentence's text. Undefined where the Sentence changed,
 * its segmentation is not cached, or the link is not one unit's.
 */
const occurrenceKeysOf = Effect.fnUntraced(function* (
	content: string,
	links: readonly ScrollLink[],
	cache: SegmentationCache["Service"],
	segmenterVersion: string,
) {
	const scroll = scrollSentences(content);
	const instances = sentenceInstances(
		scroll.sentences.map(({ text }) => text),
	);
	const keys = new Map<number, string | undefined>();
	for (const link of links) {
		const index = scroll.sentences.findIndex(
			({ source }) =>
				source.from <= link.shown.from && link.shown.to <= source.to,
		);
		const sentence = scroll.sentences[index];
		keys.set(linkKeyOf(link), undefined);
		if (!sentence) continue;
		const key = sentenceKey(segmenterVersion, "de", sentence.text);
		const cached = Option.filter(
			yield* cache.get(key),
			(entry) => entry.text === sentenceStitchedText(sentence.text),
		);
		if (Option.isNone(cached)) continue;
		const segmented = cached.value;
		const ranges = segmentSourceRanges(
			scroll,
			sentence,
			segmented.segments,
		);
		const covered = segmented.segments.flatMap((segment, at) => {
			const range = ranges[at];
			return segment.kind !== "Whitespace" &&
				range !== undefined &&
				range.from < range.to &&
				link.shown.from <= range.from &&
				range.to <= link.shown.to
				? [at]
				: [];
		});
		const units = segmented.units.filter((unit) =>
			covered.some((at) => unit.segments.includes(at)),
		);
		const [unit] = units;
		if (
			covered.length === 0 ||
			units.length !== 1 ||
			!unit ||
			!covered.every((at) => unit.segments.includes(at))
		)
			continue;
		keys.set(
			linkKeyOf(link),
			occurrenceKeyOf(
				{ segments: [...unit.segments], sentenceKey: key },
				instances[index] ?? 0,
			),
		);
	}
	return keys;
});

type Checked =
	| { readonly _tag: "Busy" }
	| { readonly _tag: "Done"; readonly removed: number };

/** Checks one Scroll and removes the occurrences it no longer links. */
const checkScroll = Effect.fnUntraced(function* (
	deps: UnlinkObserverDeps,
	store: UnlinkStore,
	scrollPath: string,
): Effect.fn.Return<Checked, unknown> {
	if (deps.activity.busy(scrollPath)) return { _tag: "Busy" };
	const stored = yield* store.attestationLinksWithRefPrefix(
		attestationRefPrefixOf(scrollPath),
	);
	if (stored.length === 0) return { _tag: "Done", removed: 0 };
	const content = yield* deps.scrolls.read(scrollPath);
	if (content === undefined) return { _tag: "Done", removed: 0 };
	const basename = scrollBasenameOf(scrollPath);

	const recorded: RecordedOccurrence[] = [];
	const resolvesHere = new Map<string, boolean>();
	for (const { reading, ref } of stored) {
		const parsed = parseAttestationRef(ref);
		const location = yield* store.readingLocation(reading);
		if (!parsed || parsed.scrollBasename !== basename || !location)
			continue;
		let here = resolvesHere.get(location.path);
		if (here === undefined) {
			here =
				(yield* deps.scrolls.resolve(basename, location.path)) ===
				scrollPath;
			resolvesHere.set(location.path, here);
		}
		if (here)
			recorded.push({
				blockId: parsed.blockId,
				occurrence: parsed.occurrence,
				readingPath: location.path,
				ref,
			});
	}
	if (recorded.length === 0) return { _tag: "Done", removed: 0 };

	const links = dictionaryLinksOf(content);
	const missing = new Set<string>();
	for (const notePath of new Set(links.map((link) => link.notePath))) {
		const parsed = parseNotePath(notePath);
		if (parsed.ok && parsed.value.type === "crossroad") continue;
		if (!(yield* deps.scrolls.exists(notePath))) missing.add(notePath);
	}
	const judge = (keys?: ReadonlyMap<number, string | undefined>) =>
		unlinkedOccurrences({
			content,
			isMissingNote: (notePath) => missing.has(notePath),
			links,
			recorded,
			...(keys === undefined ? {} : { keys }),
		});
	let judged = judge();
	if (judged.unkeyed.length > 0)
		judged = judge(
			yield* occurrenceKeysOf(
				content,
				judged.unkeyed,
				deps.cache,
				deps.segmenterVersion(),
			),
		);

	let removed = 0;
	for (const ref of judged.unlinked)
		for (let attempt = 1; ; attempt++) {
			const outcome = yield* removeOccurrence(store, ref);
			if (outcome === "Removed") {
				removed++;
				break;
			}
			if (attempt >= MAX_COMMIT_ATTEMPTS) {
				logger.warn(
					`[Classify] Could not remove the unlinked occurrence ${ref}: the dictionary kept changing`,
				);
				break;
			}
		}
	return { _tag: "Done", removed };
});

type Watched = {
	timer: ReturnType<typeof setTimeout> | undefined;
	/** Modified again while its check ran: check once more. */
	again: boolean;
};

export function createUnlinkObserver(deps: UnlinkObserverDeps): UnlinkObserver {
	const quietMs = deps.quietMs ?? UNLINK_QUIET_MS;
	const watched = new Map<string, Watched>();
	const idleWaiters: (() => void)[] = [];
	let closed = false;

	const settle = (path: string) => {
		watched.delete(path);
		deps.onEnd?.();
		if (watched.size === 0)
			for (const resolve of idleWaiters.splice(0)) resolve();
	};

	const run = <A>(effect: Effect.Effect<A, unknown>) =>
		Effect.runPromise(
			effect.pipe(
				Effect.catchCause((cause) =>
					Effect.sync(() => {
						logger.warn(
							"[Classify] Checking a Scroll's links failed:",
							getErrorMessage(cause),
						);
						return undefined;
					}),
				),
			),
		);

	const schedule = (path: string, entry: Watched, delay = quietMs) => {
		if (entry.timer !== undefined) clearTimeout(entry.timer);
		entry.timer = setTimeout(() => {
			entry.timer = undefined;
			void check(path, entry);
		}, delay);
	};

	const check = async (path: string, entry: Watched) => {
		if (closed) return settle(path);
		if (deps.blockedBy?.() !== undefined) return schedule(path, entry);
		// A run that just ended may have links its editor has not saved yet.
		const sinceRun = Date.now() - (deps.activity.endedAt(path) ?? 0);
		if (sinceRun < quietMs)
			return schedule(path, entry, quietMs - sinceRun);
		entry.again = false;
		const checked = await run(
			deps.store.pipe(
				Effect.flatMap((store) =>
					exclusive(store)(checkScroll(deps, store, path)),
				),
			),
		);
		if (closed) return settle(path);
		if (checked?._tag === "Busy") {
			await deps.activity.idle(path);
			return schedule(path, entry);
		}
		if (checked?._tag === "Done" && checked.removed > 0)
			deps.notify?.(
				`✓ Removed ${checked.removed} occurrence${checked.removed === 1 ? "" : "s"} you unlinked in ${scrollBasenameOf(path)}`,
			);
		if (entry.again) return schedule(path, entry);
		settle(path);
	};

	/** Watches a Scroll only while the dictionary holds refs into it. */
	const start = async (path: string) => {
		const entry: Watched = { again: false, timer: undefined };
		watched.set(path, entry);
		deps.onStart?.();
		const holdsRefs = await run(
			deps.store.pipe(
				Effect.flatMap((store) =>
					store.attestationLinksWithRefPrefix(
						attestationRefPrefixOf(path),
					),
				),
				Effect.map((links) => links.length > 0),
			),
		);
		if (closed || holdsRefs !== true) return settle(path);
		schedule(path, entry);
	};

	return {
		close: () => {
			closed = true;
			for (const [path, entry] of watched)
				if (entry.timer !== undefined) {
					clearTimeout(entry.timer);
					settle(path);
				}
		},
		modified: (paths) => {
			if (closed) return;
			for (const path of paths) {
				if (!path.endsWith(".md") || path.startsWith("Worter/"))
					continue;
				const entry = watched.get(path);
				if (!entry) void start(path);
				else if (entry.timer !== undefined) schedule(path, entry);
				else entry.again = true;
			}
		},
		whenIdle: () =>
			watched.size === 0
				? Promise.resolve()
				: new Promise<void>((resolve) => {
						idleWaiters.push(resolve);
					}),
	};
}
