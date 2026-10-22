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
 *   period after it ended. The check reads and judges outside the store's
 *   lock; each removal is a store transaction (`transact`) whose plan,
 *   under the lock Classify's commits take, removes nothing when a run is
 *   going on the Scroll or one ended since the check began, a dictionary
 *   reset holds Classify, or the ref's recorded Readings changed since the
 *   check read them. The check then runs again, so no run commits between
 *   the judgement and its removals.
 * - **The ref's Scroll.** Refs name a Scroll by its basename, or by its
 *   path where a rename left the basename to another note (#99); they
 *   count only when Obsidian resolves that name, from their Reading note,
 *   to the modified file.
 * - **The same Scroll.** Block IDs run `^0`, `^1`… in every classified
 *   file, so another file that took the Scroll's name, or one that replaced
 *   it, would hold the refs' blocks too. A check judges a file in full only
 *   when it still links one of its recorded occurrences in that
 *   occurrence's block. Once its last link is gone, it judges only the
 *   occurrences whose own Sentence the file still holds in their block: one
 *   of the Sentence's cached units gives back the occurrence's key. The key
 *   hashes the Sentence's text, not the Scroll, so another file holding the
 *   same Sentence in a block of the same ID passes for that occurrence
 *   alone, never for the rest. Anything else removes nothing.
 * - **Links as Obsidian resolves them.** Every wikilink and embed in the
 *   Scroll is resolved from the Scroll, as Obsidian opens it, so a link the
 *   link updater rewrote to the shortest path still links its Reading. A
 *   link that resolves to no note leaves its block alone.
 * - **Ambiguity.** `unlinkedOccurrences` leaves alone whatever a gone
 *   block, moved text, a lost block ID or a link in flux could explain.
 * - **Dictionary Sync.** Sync can bring refs into Reading notes ahead of
 *   the Scroll that links them, and an edit to the stale Scroll would read
 *   as their removal. VAM reports every dictionary note modified from
 *   outside, as its own writes are filtered, so a check waits until no
 *   dictionary note has been modified from outside for `sweepQuietMs`,
 *   and the Scroll catching up lands first. A Scroll that lands later than
 *   that is still judged as it is.
 *
 * Links removed while the plugin was not running, such as in another
 * editor or on another device, reach no modification. `sweep` catches up
 * on them once at startup (#161): it finds every Scroll the dictionary
 * holds refs into and checks each as if it had just been modified, through
 * the same quiet period, lock and removals. Nothing told it the Scroll was
 * edited, so a check the sweep asked for judges less:
 *
 * - **Settled refs only.** Only the occurrences recorded when the sweep
 *   began, whose Reading note was then no newer than the Scroll: the
 *   dictionary may have synced a ref ahead of the Scroll that links it, and
 *   Classify always writes a Scroll's links after the refs.
 * - **The same Scroll, by its links alone.** Only a Scroll that still links
 *   one of its recorded occurrences, so another file that took its name, or
 *   an old version that replaced it, removes nothing. The Sentences it
 *   holds do not count here: nothing tells the sweep the user removed the
 *   last link, and an old version of the Scroll holds them too.
 * - **A quiet vault.** Its checks wait until no Markdown file has been
 *   modified from outside for `sweepQuietMs`, so Sync catching up at
 *   startup lands first.
 *
 * A Scroll modified while its check is pending is judged in full, as any
 * edit is. What the sweep removed is told in one notice once its last
 * check is done.
 */
import type {
	DictionaryView,
	DumdictVaultStore,
	Transaction,
} from "@textfresser/dictionary";
import {
	ATTESTATION_REF_START,
	attestationRefPrefix,
	parseNotePath,
	pathCollisionKey,
	WORTER_FOLDER,
} from "@textfresser/lemma-note-codec";
import { VaultPath } from "@textfresser/vault-action-manager";
import type { AttestationLink } from "dumdict";
import { readingIdentityKey } from "dumling";
import { Effect, Option, Result } from "effect";
import { getErrorMessage } from "../../../utils/get-error-message";
import { logger } from "../../../utils/logger";
import { scrollSentences, segmentSourceRanges } from "../scroll-sentences";
import type { SegmentationCache } from "../segmentation-cache";
import {
	sentenceInstances,
	sentenceKey,
	sentenceStitchedText,
} from "../sentence-key";
import { MAX_COMMIT_ATTEMPTS, planRemoval } from "./commit-occurrence";
import type { DictionaryCommitFailed } from "./knowledge-types";
import type { ScrollActivity } from "./scroll-activity";
import {
	attestationRefPrefixOf,
	occurrenceKeyOf,
	parseAttestationRef,
	scrollBasenameOf,
	scrollLinkpathOf,
	sourceBlocksOf,
} from "./scroll-links";
import {
	linkKeyOf,
	linksOneOf,
	type RecordedOccurrence,
	type ScrollLink,
	scrollLinksOf,
	unlinkedOccurrences,
} from "./scroll-unlinks";

/** How long a Scroll stays unmodified before its links are checked. */
const UNLINK_QUIET_MS = 5_000;

/** How many quiet periods the vault stays unmodified before the sweep's checks run. */
const SWEEP_QUIET_PERIODS = 3;

/** The part of the dictionary store the observer reads and removes through. */
export type UnlinkStore = Pick<
	DumdictVaultStore,
	"attestationLinksWithRefPrefix" | "readingLocation" | "transact"
>;

/** The Scrolls the observer reads, and how Obsidian resolves a ref's Scroll. */
export type UnlinkScrolls = {
	/** The Scroll's content as the editor or the vault holds it; none when it is gone. */
	readonly read: (path: string) => Effect.Effect<string | undefined>;
	/** The Markdown note Obsidian opens for `linkpath` from `sourcePath`, if any. */
	readonly resolve: (
		linkpath: string,
		sourcePath: string,
	) => Effect.Effect<string | undefined>;
	/** When the file at `path` was last modified, by `Date.now()`; none when it is gone. */
	readonly modifiedAt: (path: string) => Effect.Effect<number | undefined>;
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
	/**
	 * How long no Markdown file may be modified before the sweep's checks
	 * run, and no dictionary note before any check runs.
	 */
	readonly sweepQuietMs?: number;
	/** Called as a check is pending and once it is done, for the plugin's idle tracker. */
	readonly onStart?: () => void;
	readonly onEnd?: () => void;
};

export type UnlinkObserver = {
	/** Tells the observer these Markdown files changed. */
	readonly modified: (paths: readonly string[]) => void;
	/**
	 * Checks every Scroll the dictionary holds refs into, for links removed
	 * while the plugin was not running. Run once the dictionary and the
	 * Librarian are ready; it does not wait for the checks.
	 */
	readonly sweep: () => void;
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

/**
 * The refs of `recorded` whose occurrence stands in its block of the Scroll
 * as it was recorded: a Sentence of that block, its segmentation cached,
 * has a unit whose occurrence key is the recorded one. The key hashes the
 * Sentence's text, so an edited Sentence gives it back for none, and a
 * cache miss counts as not held.
 */
const recordedSentencesHeld = Effect.fnUntraced(function* (
	content: string,
	recorded: readonly RecordedOccurrence[],
	cache: SegmentationCache["Service"],
	segmenterVersion: string,
) {
	const wanted = new Map<string, string[]>();
	for (const { blockId, occurrence, ref } of recorded) {
		const key = `${blockId}\u0000${occurrence}`;
		wanted.set(key, [...(wanted.get(key) ?? []), ref]);
	}
	const recordedBlocks = new Set(recorded.map(({ blockId }) => blockId));
	const held = new Set<string>();
	const scroll = scrollSentences(content);
	const instances = sentenceInstances(
		scroll.sentences.map(({ text }) => text),
	);
	const blocks = sourceBlocksOf(
		content,
		scroll.sentences.map(({ source }) => source.from),
	);
	for (const [index, sentence] of scroll.sentences.entries()) {
		const block = blocks.get(sentence.source.from);
		if (block?._tag !== "Identified" || !recordedBlocks.has(block.id))
			continue;
		const key = sentenceKey(segmenterVersion, "de", sentence.text);
		const cached = Option.filter(
			yield* cache.get(key),
			(entry) => entry.text === sentenceStitchedText(sentence.text),
		);
		if (Option.isNone(cached)) continue;
		for (const unit of cached.value.units) {
			const occurrence = occurrenceKeyOf(
				{ segments: [...unit.segments], sentenceKey: key },
				instances[index] ?? 0,
			);
			for (const ref of wanted.get(`${block.id}\u0000${occurrence}`) ??
				[])
				held.add(ref);
		}
	}
	return held;
});

/** The extensions of the files besides notes that Obsidian links and embeds. */
const ATTACHMENT =
	/\.(?:3gp|avif|base|bmp|canvas|flac|gif|jpe?g|m4a|mkv|mov|mp3|mp4|ogg|ogv|pdf|png|svg|wav|webm|webp)$/iu;

/**
 * The Scroll's wikilinks and embeds, each resolved from the Scroll as
 * Obsidian opens it. A note that is one of `recorded`'s Reading notes is
 * named as the dictionary names it. Links into the Scroll itself and to
 * attachments are left out, and so are Crossroad links that resolve to no
 * note, as a Crossroad is written only once it is needed.
 */
const resolvedLinksOf = Effect.fnUntraced(function* (
	scrolls: UnlinkScrolls,
	scrollPath: string,
	content: string,
	recorded: readonly RecordedOccurrence[],
) {
	// The store keeps no two dictionary notes at one collision key.
	const readingPaths = new Map(
		recorded.map(({ readingPath }) => [
			pathCollisionKey(readingPath),
			readingPath,
		]),
	);
	const resolved = new Map<string, string | undefined>();
	const links: ScrollLink[] = [];
	for (const { block, linkpath, shown } of scrollLinksOf(content)) {
		if (linkpath === "" || ATTACHMENT.test(linkpath)) continue;
		if (!resolved.has(linkpath)) {
			const found = yield* scrolls.resolve(linkpath, scrollPath);
			resolved.set(
				linkpath,
				found === undefined
					? undefined
					: (readingPaths.get(pathCollisionKey(found)) ?? found),
			);
		}
		const notePath = resolved.get(linkpath);
		if (notePath === undefined) {
			const parsed = parseNotePath(
				linkpath.endsWith(".md") ? linkpath : `${linkpath}.md`,
			);
			if (parsed.ok && parsed.value.type === "crossroad") continue;
		}
		links.push({ block, notePath, shown });
	}
	return links;
});

type Checked =
	| { readonly _tag: "Busy" }
	| {
			readonly _tag: "Done";
			readonly removed: number;
			/** A removal found the Scroll or its refs moved on since the check read them. */
			readonly again: boolean;
	  };

/** Why a removal's plan removed nothing and the Scroll is checked again. */
type Withheld = "Busy" | "Blocked" | "Changed";

/** The Readings a ref is recorded under, as one comparable key. */
const recordedUnder = (links: readonly AttestationLink<"de">[], ref: string) =>
	links
		.filter((link) => link.ref === ref)
		.map(({ reading }) => readingIdentityKey(reading))
		.sort()
		.join("\u0000");

/**
 * Plans removing one unlinked ref, under the store's lock, only while what
 * the check judged still holds: no run on the Scroll and none ended since
 * the check began, no reset holding Classify, and the ref recorded under
 * the Readings the check read.
 */
const planUnlinkedRemoval =
	(
		deps: UnlinkObserverDeps,
		scrollPath: string,
		endedAt: number | undefined,
		ref: string,
		readings: string,
	) =>
	(
		view: DictionaryView,
	): Result.Result<
		Transaction<"Removed" | Withheld>,
		DictionaryCommitFailed
	> => {
		if (deps.blockedBy?.() !== undefined)
			return Result.succeed(stopWith("Blocked"));
		if (
			deps.activity.busy(scrollPath) ||
			deps.activity.endedAt(scrollPath) !== endedAt
		)
			return Result.succeed(stopWith("Busy"));
		if (
			recordedUnder(view.attestationLinksWithRefPrefix(ref), ref) !==
			readings
		)
			return Result.succeed(stopWith("Changed"));
		return planRemoval(view, ref);
	};

const stopWith = (withheld: Withheld): Transaction<Withheld> => ({
	_tag: "Stop",
	value: withheld,
});

/** An occurrence as the sweep settles it: its Reading note and its ref. */
const settledKeyOf = (readingPath: string, ref: string) =>
	`${readingPath}\u0000${ref}`;

/**
 * The Scrolls the sweep checks, as Obsidian resolves each ref's Scroll from
 * its Reading note, and the occurrences it may judge in them, by
 * `settledKeyOf`: those whose Reading note was no newer than their Scroll
 * as it began. The others' refs may have arrived ahead of the Scroll that
 * links them.
 */
const scrollsWithRefs = Effect.fnUntraced(function* (
	deps: UnlinkObserverDeps,
	store: UnlinkStore,
) {
	const found: { scrollPath: string; readingPath: string; ref: string }[] =
		[];
	const resolved = new Map<string, string | undefined>();
	for (const { reading, ref } of yield* store.attestationLinksWithRefPrefix(
		ATTESTATION_REF_START,
	)) {
		const parsed = parseAttestationRef(ref);
		const location = yield* store.readingLocation(reading);
		if (!parsed || !location) continue;
		const key = `${parsed.linkpath}\u0000${location.path}`;
		if (!resolved.has(key))
			resolved.set(
				key,
				yield* deps.scrolls.resolve(parsed.linkpath, location.path),
			);
		const scrollPath = resolved.get(key);
		if (scrollPath !== undefined)
			found.push({ readingPath: location.path, ref, scrollPath });
	}
	const modifiedAt = new Map<string, number | undefined>();
	for (const { readingPath, scrollPath } of found)
		for (const path of [scrollPath, readingPath])
			if (!modifiedAt.has(path))
				modifiedAt.set(path, yield* deps.scrolls.modifiedAt(path));
	const scrolls = new Set<string>();
	const settled = new Set<string>();
	for (const { readingPath, ref, scrollPath } of found) {
		const scrollAt = modifiedAt.get(scrollPath);
		const noteAt = modifiedAt.get(readingPath);
		if (scrollAt === undefined || noteAt === undefined || noteAt > scrollAt)
			continue;
		scrolls.add(scrollPath);
		settled.add(settledKeyOf(readingPath, ref));
	}
	return { scrolls: [...scrolls].sort(), settled };
});

/**
 * What the sweep may judge of a Scroll's recorded occurrences: none unless
 * the Scroll still links one of them in its block, else the settled ones.
 */
const sweptInScroll = (
	settled: ReadonlySet<string>,
	links: readonly ScrollLink[],
	recorded: readonly RecordedOccurrence[],
) =>
	linksOneOf(links, recorded)
		? recorded.filter(({ readingPath, ref }) =>
				settled.has(settledKeyOf(readingPath, ref)),
			)
		: [];

/**
 * The stored links whose refs name the Scroll at `scrollPath`, by its
 * basename or by its path.
 */
const refsInto = Effect.fnUntraced(function* (
	store: UnlinkStore,
	scrollPath: string,
) {
	const byName = attestationRefPrefixOf(scrollPath);
	const byPath = attestationRefPrefix(scrollLinkpathOf(scrollPath));
	const links = [...(yield* store.attestationLinksWithRefPrefix(byName))];
	// A Scroll at the vault root has one name for both.
	if (byPath !== byName)
		links.push(...(yield* store.attestationLinksWithRefPrefix(byPath)));
	return links;
});

/**
 * Checks one Scroll and removes the occurrences it no longer links, once
 * the file proves to be their Scroll. A check the sweep asked for, given
 * the occurrences it settled, judges only those `sweptInScroll` keeps.
 */
const checkScroll = Effect.fnUntraced(function* (
	deps: UnlinkObserverDeps,
	store: UnlinkStore,
	scrollPath: string,
	swept: ReadonlySet<string> | undefined,
): Effect.fn.Return<Checked, unknown> {
	if (deps.activity.busy(scrollPath)) return { _tag: "Busy" };
	const endedAt = deps.activity.endedAt(scrollPath);
	const nothing: Checked = { _tag: "Done", again: false, removed: 0 };
	const stored = yield* refsInto(store, scrollPath);
	if (stored.length === 0) return nothing;
	const content = yield* deps.scrolls.read(scrollPath);
	if (content === undefined) return nothing;
	const names = new Set([
		scrollBasenameOf(scrollPath),
		scrollLinkpathOf(scrollPath),
	]);

	let recorded: RecordedOccurrence[] = [];
	const resolvesHere = new Map<string, boolean>();
	for (const { reading, ref } of stored) {
		const parsed = parseAttestationRef(ref);
		const location = yield* store.readingLocation(reading);
		if (!parsed || !names.has(parsed.linkpath) || !location) continue;
		const key = `${parsed.linkpath}\u0000${location.path}`;
		let here = resolvesHere.get(key);
		if (here === undefined) {
			here =
				(yield* deps.scrolls.resolve(
					parsed.linkpath,
					location.path,
				)) === scrollPath;
			resolvesHere.set(key, here);
		}
		if (here)
			recorded.push({
				blockId: parsed.blockId,
				occurrence: parsed.occurrence,
				readingPath: location.path,
				ref,
			});
	}
	if (recorded.length === 0) return nothing;
	const links = yield* resolvedLinksOf(
		deps.scrolls,
		scrollPath,
		content,
		recorded,
	);
	if (swept) recorded = sweptInScroll(swept, links, recorded);
	else if (!linksOneOf(links, recorded)) {
		const held = yield* recordedSentencesHeld(
			content,
			recorded,
			deps.cache,
			deps.segmenterVersion(),
		);
		recorded = recorded.filter(({ ref }) => held.has(ref));
	}
	if (recorded.length === 0) return nothing;

	const judge = (keys?: ReadonlyMap<number, string | undefined>) =>
		unlinkedOccurrences({
			content,
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
	for (const ref of judged.unlinked) {
		const outcome = yield* store
			.transact(
				planUnlinkedRemoval(
					deps,
					scrollPath,
					endedAt,
					ref,
					recordedUnder(stored, ref),
				),
				{ maxAttempts: MAX_COMMIT_ATTEMPTS },
			)
			.pipe(
				Effect.catchTag("DictionaryTransactionConflict", () =>
					Effect.sync(() => {
						logger.warn(
							`[Classify] Could not remove the unlinked occurrence ${ref}: the dictionary kept changing`,
						);
						return "Skipped" as const;
					}),
				),
			);
		if (outcome === "Removed") removed++;
		else if (outcome !== "Skipped")
			return { _tag: "Done", again: true, removed };
	}
	return { _tag: "Done", again: false, removed };
});

type Watched = {
	timer: ReturnType<typeof setTimeout> | undefined;
	/** Modified again while its check ran: check once more. */
	again: boolean;
	/** Asked for by the startup sweep and not modified since. */
	sweep: SweepRun | undefined;
};

/** One startup sweep: what its checks may judge, and what they removed. */
type SweepRun = {
	/** The occurrences its checks may judge, by `settledKeyOf`. */
	readonly settled: ReadonlySet<string>;
	/** Its checks not done yet. */
	left: number;
	removed: number;
	/** The Scrolls its checks removed occurrences from. */
	readonly scrolls: string[];
};

const removedNotice = (removed: number, where: string) =>
	`✓ Removed ${removed} occurrence${removed === 1 ? "" : "s"} you unlinked in ${where}`;

export function createUnlinkObserver(deps: UnlinkObserverDeps): UnlinkObserver {
	const quietMs = deps.quietMs ?? UNLINK_QUIET_MS;
	const sweepQuietMs = deps.sweepQuietMs ?? SWEEP_QUIET_PERIODS * quietMs;
	const watched = new Map<string, Watched>();
	const idleWaiters: (() => void)[] = [];
	let sweeping = 0;
	let closed = false;
	/** When a Markdown file was last modified from outside, as VAM reported it. */
	let vaultModifiedAt = Number.NEGATIVE_INFINITY;
	/** When a dictionary note was last modified from outside, as VAM reported it. */
	let dictionaryModifiedAt = Number.NEGATIVE_INFINITY;

	const wakeIdle = () => {
		if (watched.size === 0 && sweeping === 0)
			for (const resolve of idleWaiters.splice(0)) resolve();
	};

	/** The check no longer counts toward its sweep; the sweep's last tells what it removed. */
	const leaveSweep = (entry: Watched) => {
		const sweep = entry.sweep;
		if (!sweep) return;
		entry.sweep = undefined;
		sweep.left--;
		if (sweep.left > 0 || closed || sweep.removed === 0) return;
		logger.info(
			`[Classify] The startup sweep removed ${sweep.removed} unlinked occurrences from: ${sweep.scrolls.join(", ")}`,
		);
		const [only] = sweep.scrolls;
		deps.notify?.(
			removedNotice(
				sweep.removed,
				sweep.scrolls.length === 1 && only !== undefined
					? scrollBasenameOf(only)
					: `${sweep.scrolls.length} Scrolls`,
			),
		);
	};

	const settle = (path: string) => {
		const entry = watched.get(path);
		if (entry) leaveSweep(entry);
		watched.delete(path);
		deps.onEnd?.();
		wakeIdle();
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
		// Sync may still be bringing the Scroll or its refs up to date.
		const sinceVault = Date.now() - vaultModifiedAt;
		if (entry.sweep && sinceVault < sweepQuietMs)
			return schedule(path, entry, sweepQuietMs - sinceVault);
		// Sync may have brought refs ahead of the Scroll that links them.
		const sinceDictionary = Date.now() - dictionaryModifiedAt;
		if (sinceDictionary < sweepQuietMs)
			return schedule(path, entry, sweepQuietMs - sinceDictionary);
		entry.again = false;
		const checked = await run(
			deps.store.pipe(
				Effect.flatMap((store) =>
					checkScroll(deps, store, path, entry.sweep?.settled),
				),
			),
		);
		if (closed) return settle(path);
		if (checked?._tag === "Busy") {
			await deps.activity.idle(path);
			return schedule(path, entry);
		}
		if (checked?._tag === "Done" && checked.removed > 0) {
			if (entry.sweep) {
				entry.sweep.removed += checked.removed;
				entry.sweep.scrolls.push(path);
			} else
				deps.notify?.(
					removedNotice(checked.removed, scrollBasenameOf(path)),
				);
		}
		if (entry.again || (checked?._tag === "Done" && checked.again))
			return schedule(path, entry);
		settle(path);
	};

	const watch = (path: string, sweep: SweepRun | undefined) => {
		const entry: Watched = { again: false, sweep, timer: undefined };
		watched.set(path, entry);
		deps.onStart?.();
		return entry;
	};

	/** Watches a Scroll only while the dictionary holds refs into it. */
	const start = async (path: string) => {
		const entry = watch(path, undefined);
		const holdsRefs = await run(
			deps.store.pipe(
				Effect.flatMap((store) => refsInto(store, path)),
				Effect.map((links) => links.length > 0),
			),
		);
		if (closed || holdsRefs !== true) return settle(path);
		schedule(path, entry);
	};

	const inWorter = (path: string) =>
		VaultPath.caseSensitive.isUnder(path, WORTER_FOLDER, {
			inclusive: false,
		});
	const isDictionaryPath = (path: string) =>
		path.endsWith(".md") && inWorter(path);
	const isScrollPath = (path: string) =>
		path.endsWith(".md") && !inWorter(path);

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
			if (paths.length > 0) vaultModifiedAt = Date.now();
			for (const path of paths) {
				if (isDictionaryPath(path)) dictionaryModifiedAt = Date.now();
				if (!isScrollPath(path)) continue;
				const entry = watched.get(path);
				if (!entry) {
					void start(path);
					continue;
				}
				leaveSweep(entry);
				if (entry.timer !== undefined) schedule(path, entry);
				else entry.again = true;
			}
		},
		sweep: () => {
			if (closed) return;
			sweeping++;
			deps.onStart?.();
			void run(
				deps.store.pipe(
					Effect.flatMap((store) => scrollsWithRefs(deps, store)),
				),
			).then((found) => {
				sweeping--;
				deps.onEnd?.();
				if (!closed && found) {
					const sweep: SweepRun = {
						left: 0,
						removed: 0,
						scrolls: [],
						settled: found.settled,
					};
					// A Scroll already watched is checked in full anyway.
					const paths = found.scrolls.filter(
						(path) => isScrollPath(path) && !watched.has(path),
					);
					sweep.left = paths.length;
					for (const path of paths)
						schedule(path, watch(path, sweep));
				}
				wakeIdle();
			});
		},
		whenIdle: () =>
			watched.size === 0 && sweeping === 0
				? Promise.resolve()
				: new Promise<void>((resolve) => {
						idleWaiters.push(resolve);
					}),
	};
}
