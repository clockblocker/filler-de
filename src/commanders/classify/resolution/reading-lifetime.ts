/**
 * How long a Reading lives (#281, #290): while it has an Attestation, or
 * while a link from a file outside `Worter/` points at its Reading note or
 * its Lemma note. Classify links every unit and commits its Reading with
 * no Attestation; a click adds one; removing an Attestation keeps the
 * Reading it empties (`emptyReading: "Keep"`). A Reading with neither goes
 * with dumdict's `removeReading` and its cascade: its Surfaces no other
 * link names, its Lemma with its last Reading, and the claims on them. The
 * store follows a removed Lemma with the Shadow re-evaluation, the
 * Breakdown and Source re-pointing, the Formations and the Crossroad
 * notes, as it follows any commit that removes one.
 *
 * **A Reading goes by itself only on a transition the lifetime saw:** a
 * file that is there, and that it recorded linking the Reading's note, is
 * resolved again by Obsidian and no longer links it. A file's absence
 * never removes anything: a deleted Scroll, one moved into `Worter/`, one
 * Sync has not brought yet, one iCloud evicted. Neither does the start,
 * which only brings the index up to the files that are there. So a Reading
 * the index never saw linked, as one from before it, never goes by itself.
 * "Clean up unlinked Readings…" removes the rest, on the user's word
 * (`unlinked`, `removeUnlinked`).
 *
 * The index (`link-index.ts`) holds which notes under `Worter/` each file
 * outside it links, as Obsidian last resolved them, and the Readings a
 * file was seen to stop linking ("released"), kept per device across
 * restarts. A released Reading with an Attestation waits: once the unlink
 * observer removes that Attestation, it tells the lifetime (`suspect`).
 *
 * What keeps the links a Reading has from being missed:
 *
 * - **Every present file.** Links count from any Markdown file outside
 *   `Worter/`, and from canvases: their text cards' wikilinks and their
 *   file cards. A link to a Reading's Lemma note keeps all its Readings.
 * - **Links in flux.** A file holding a link that resolves to nothing but
 *   names `Worter/`, or a note named like a Reading (`🌊 See`), as after a
 *   Reading note was renamed with link updating off, still links what it
 *   linked before.
 * - **Resolved links.** Nothing is judged until Obsidian has resolved the
 *   links of every file it is indexing (`NoteLinks.settled`).
 * - **Quiet period.** A check runs only once no link has changed for
 *   `quietMs`, so a link cut from one note and pasted into another counts.
 * - **Classify runs and clicks.** A run commits each unit's Reading before
 *   it writes the link to it, deciding and committing under its Lemma's
 *   lock; a click attests through such a run. Both count as Scroll
 *   activity. No check runs while a run goes on any Scroll, within
 *   `quietMs` of the last one ending, or while a Knowledge run is going.
 *   Each removal is a store transaction whose plan, under the lock
 *   Classify's commits take, removes nothing when a run is going on, one
 *   ended since the check began, or a dictionary reset holds Classify, and
 *   reads the Reading and the links again.
 * - **Dictionary Sync.** No check runs until no dictionary note has been
 *   modified from outside for `sweepQuietMs`.
 */
import type {
	DictionaryCommitError,
	DictionaryView,
	DumdictVaultStore,
	StoredReadingNote,
	Transaction,
} from "@textfresser/dictionary";
import { WORTER_FOLDER } from "@textfresser/lemma-note-codec";
import { VaultPath } from "@textfresser/vault-action-manager";
import type * as Dumling from "dumling/types";
import {
	Cause,
	Clock,
	Effect,
	FiberHandle,
	Result,
	type Scope,
	Stream,
	SubscriptionRef,
} from "effect";
import { interruptsOf } from "../../../utils/causes";
import { IdleTracker } from "../../../utils/idle-tracker";
import { MAX_COMMIT_ATTEMPTS, planReadingRemoval } from "./commit-occurrence";
import type { KnowledgeQueue } from "./knowledge-queue";
import type { DictionaryCommitFailed } from "./knowledge-types";
import type { LinkIndexStore } from "./link-index";
import type { ScrollActivity } from "./scroll-activity";

/** How long no link may change before a check runs. */
const LIFETIME_QUIET_MS = 5_000;

/** How many quiet periods no dictionary note may be modified before a check runs. */
const SWEEP_QUIET_PERIODS = 3;

/** Each file's links to notes, by path, with how often it links each. */
type ResolvedLinks = Readonly<Record<string, Readonly<Record<string, number>>>>;

/** Obsidian's link index, as the lifetime reads it. */
export type NoteLinks = {
	/**
	 * Every Markdown file's resolved links (`MetadataCache.resolvedLinks`).
	 * Read synchronously, as a store transaction's plan reads it.
	 */
	readonly resolvedLinks: () => ResolvedLinks;
	/** Every Markdown file's links that resolve to no file (`unresolvedLinks`). */
	readonly unresolvedLinks: () => ResolvedLinks;
	/** Every canvas's links: its text cards' wikilinks and its file cards, resolved. */
	readonly canvasLinks: Effect.Effect<ResolvedLinks>;
	/** Ends once Obsidian has resolved the links of every file it is indexing. */
	readonly settled: Effect.Effect<void>;
};

/** A change to which notes a file links, as Obsidian tells it. */
export type LinkChange =
	| { readonly _tag: "Resolved"; readonly path: string }
	| { readonly _tag: "Deleted"; readonly path: string }
	| { readonly _tag: "Renamed"; readonly from: string; readonly to: string };

/** The part of the dictionary store the lifetime reads and removes through. */
export type LifetimeStore = Pick<
	DumdictVaultStore,
	"readingNotes" | "transact"
>;

export type ReadingLifetimeDeps<E = unknown> = {
	readonly store: Effect.Effect<LifetimeStore, E>;
	readonly links: NoteLinks;
	/** Where the link index is kept across restarts. */
	readonly index: LinkIndexStore;
	readonly activity: Pick<ScrollActivity, "busyAnywhere" | "lastEndedAt">;
	/** Classify's Knowledge runs: no check runs while one is going. */
	readonly knowledge?: Pick<KnowledgeQueue, "running">;
	/** Why no Reading may be removed now, such as a dictionary reset. */
	readonly blockedBy?: () => string | undefined;
	readonly quietMs?: number;
	/** How long no dictionary note may be modified from outside before a check runs. */
	readonly sweepQuietMs?: number;
};

/** What "Clean up unlinked Readings…" removed, and what it found held after all. */
type CleanedUp = {
	readonly removed: readonly string[];
	/** Readings it left: gained an Attestation or a link, or a run was going. */
	readonly kept: readonly string[];
};

export type ReadingLifetime = {
	/** Obsidian resolved a file's links again, deleted one, or renamed one. */
	readonly changed: (change: LinkChange) => Effect.Effect<void>;
	/** The Reading notes at these paths may have lost their last Attestation. */
	readonly suspect: (paths: readonly string[]) => Effect.Effect<void>;
	/** Tells the lifetime these Markdown files were modified from outside, as VAM reports them. */
	readonly modified: (paths: readonly string[]) => Effect.Effect<void>;
	/**
	 * Loads the index and brings it up to the files that are there, once
	 * Obsidian has resolved them all; it removes nothing. Until then,
	 * changes are not followed. Run once the dictionary is ready.
	 */
	readonly start: Effect.Effect<void>;
	/** Every Reading with no Attestation and no link from any file there now. */
	readonly unlinked: Effect.Effect<readonly StoredReadingNote[]>;
	/** Removes these Reading notes' Readings, each only if still unattested and unlinked. */
	readonly removeUnlinked: (
		paths: readonly string[],
	) => Effect.Effect<CleanedUp>;
	/** Ends once no check is pending. */
	readonly whenIdle: Effect.Effect<void>;
};

const inWorter = (path: string) =>
	VaultPath.caseInsensitive.isUnder(path, WORTER_FOLDER, {
		inclusive: false,
	});

/** A file whose links the lifetime follows: a Markdown file outside `Worter/`. */
const isSource = (path: string) =>
	path.toLowerCase().endsWith(".md") && !inWorter(path);

/** The notes under `Worter/` that `targets` links. */
const worterTargets = (
	targets: Readonly<Record<string, number>> | undefined,
): Set<string> => {
	const found = new Set<string>();
	for (const target in targets)
		if ((targets[target] ?? 0) > 0 && inWorter(target)) found.add(target);
	return found;
};

/** A Reading note's name: its Emoji Description first, as `🌊 See`. */
const READING_NAME = /^[\p{Extended_Pictographic}\p{Regional_Indicator}]/u;

/**
 * Whether a link that resolves to nothing looks like one into `Worter/`:
 * by its path, or by a name like a Reading note's.
 */
const looksLikeWorter = (linkpath: string) => {
	const name = linkpath.split("/").at(-1) ?? linkpath;
	return (
		linkpath.toLowerCase().startsWith(`${WORTER_FOLDER.toLowerCase()}/`) ||
		READING_NAME.test(name)
	);
};

/** Every note under `Worter/` a file there now links: Markdown outside it, and canvases. */
const linkedNow = (
	resolved: ResolvedLinks,
	canvases: ResolvedLinks,
): Set<string> => {
	const linked = new Set<string>();
	for (const source in resolved) {
		if (inWorter(source)) continue;
		for (const target of worterTargets(resolved[source]))
			linked.add(target);
	}
	for (const source in canvases)
		for (const target of worterTargets(canvases[source]))
			linked.add(target);
	return linked;
};

/** Whether a file there now links the Reading at `path` or its Lemma note. */
const holds = (linked: ReadonlySet<string>, path: string, lemmaPath: string) =>
	linked.has(path) || linked.has(lemmaPath);

/**
 * Where `path` is after a rename from `from` to `to`, if it is `from` or
 * below it, as a folder's files are.
 */
const renamedPath = (path: string, from: string, to: string) =>
	path === from
		? to
		: path.startsWith(`${from}/`)
			? `${to}${path.slice(from.length)}`
			: undefined;

/** Why a removal's plan removed nothing. */
type Withheld = "Busy" | "Blocked" | "Kept";

const stopWith = (withheld: Withheld): Transaction<Withheld> => ({
	_tag: "Stop",
	value: withheld,
});

/**
 * Plans removing a Reading found with no Attestation and no link, under
 * the store's lock, only while that still holds: no Classify run going on
 * and none ended since the check began, no reset holding Classify, and the
 * Reading stored with no Attestation, and no file linking it or its Lemma
 * note. Canvases are read as the check read them.
 */
const planLifetimeRemoval =
	(
		deps: ReadingLifetimeDeps,
		reading: Dumling.Reading<"de">,
		endedAt: number | undefined,
		canvases: ResolvedLinks,
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
			deps.activity.busyAnywhere() ||
			deps.activity.lastEndedAt() !== endedAt
		)
			return Result.succeed(stopWith("Busy"));
		const location = view.readingLocation(reading);
		if (
			!location ||
			location.entry.attestationLinks.length > 0 ||
			holds(
				linkedNow(deps.links.resolvedLinks(), canvases),
				location.path,
				location.lemmaPath,
			)
		)
			return Result.succeed(stopWith("Kept"));
		return planReadingRemoval(view, reading);
	};

/** The stored Readings with no Attestation that no file there now links. */
const unlinkedAmong = (
	notes: readonly StoredReadingNote[],
	linked: ReadonlySet<string>,
) =>
	notes.filter(
		({ entry, lemmaPath, path }) =>
			entry.attestationLinks.length === 0 &&
			!holds(linked, path, lemmaPath),
	);

/** One removal, in its own transaction. */
const removeOne = (
	deps: ReadingLifetimeDeps,
	store: LifetimeStore,
	note: StoredReadingNote,
	endedAt: number | undefined,
	canvases: ResolvedLinks,
): Effect.Effect<
	"Removed" | Withheld,
	DictionaryCommitFailed | DictionaryCommitError
> =>
	store
		.transact(
			planLifetimeRemoval(deps, note.entry.reading, endedAt, canvases),
			{ maxAttempts: MAX_COMMIT_ATTEMPTS },
		)
		.pipe(
			Effect.catchTag("DictionaryTransactionConflict", () =>
				Effect.logWarning(
					`[Classify] Could not remove the Reading ${note.path}, which no Attestation or link names: the dictionary kept changing`,
				).pipe(Effect.as("Kept" as const)),
			),
		);

/**
 * The lifetime, in the current scope. Its check runs on one fiber, in a
 * `FiberHandle`, forked from the fiber that asked for it: it sleeps out
 * the quiet period, then checks. A change while it sleeps is seen when it
 * wakes, and it sleeps out the rest; one while it checks asks for another
 * check. Every wait is an `Effect.sleep` and every time a `Clock` reading,
 * so a `TestClock` drives it. Closing the scope, as the plugin unloads,
 * interrupts the check.
 */
export const makeReadingLifetime = Effect.fnUntraced(function* <E>(
	deps: ReadingLifetimeDeps<E>,
): Effect.fn.Return<ReadingLifetime, never, Scope.Scope> {
	const quietMs = deps.quietMs ?? LIFETIME_QUIET_MS;
	const sweepQuietMs = deps.sweepQuietMs ?? SWEEP_QUIET_PERIODS * quietMs;
	const idle = yield* IdleTracker;
	const handle = yield* FiberHandle.make<void>();
	const closed = () => handle.state._tag === "Closed";
	const pending = yield* SubscriptionRef.make(0);

	/** Each file outside `Worter/`'s links to notes under it, as last resolved. */
	const linksOf = new Map<string, Set<string>>();
	/** The Reading notes a file was seen to stop linking, not yet judged. */
	const released = new Set<string>();
	/** The released Reading notes to check. */
	const suspects = new Set<string>();
	const state = {
		/** Changed while a check ran: check once more. */
		again: false,
		/** When a link last changed, or a Reading was suspected. */
		changedAt: Number.NEGATIVE_INFINITY,
		/** When a dictionary note was last modified from outside. */
		dictionaryAt: Number.NEGATIVE_INFINITY,
		/** The index changed since it was last saved. */
		dirty: false,
		/** A check is scheduled or running. */
		scheduled: false,
		/** The index is loaded and up to the files there: changes are followed. */
		started: false,
		/** The check is sleeping out a quiet period. */
		waiting: false,
	};

	const track = <A, E2, R>(effect: Effect.Effect<A, E2, R>) =>
		Effect.acquireUseRelease(
			SubscriptionRef.update(pending, (n) => n + 1),
			() => effect,
			() => SubscriptionRef.update(pending, (n) => n - 1),
		).pipe(idle.track);

	const save = Effect.suspend(() => {
		if (!state.dirty) return Effect.void;
		state.dirty = false;
		const links: Record<string, string[]> = {};
		for (const [source, targets] of linksOf)
			links[source] = [...targets].sort();
		return deps.index.save({ links, released: [...released].sort() });
	});

	/** Removes the suspected Readings no Attestation or link holds. */
	const reap = Effect.fnUntraced(function* (
		store: LifetimeStore,
		asked: readonly string[],
		endedAt: number | undefined,
	): Effect.fn.Return<
		"Withheld" | readonly string[],
		DictionaryCommitFailed | DictionaryCommitError
	> {
		const wanted = new Set(asked);
		const notes = (yield* store.readingNotes).filter(({ path }) =>
			wanted.has(path),
		);
		const stored = new Set(notes.map(({ path }) => path));
		for (const path of asked)
			if (!stored.has(path)) {
				released.delete(path);
				state.dirty = true;
			}
		const canvases = yield* deps.links.canvasLinks;
		const linked = linkedNow(deps.links.resolvedLinks(), canvases);
		const removed: string[] = [];
		for (const note of notes) {
			// It waits for the unlink observer to remove its Attestations.
			if (note.entry.attestationLinks.length > 0) continue;
			if (holds(linked, note.path, note.lemmaPath)) {
				released.delete(note.path);
				state.dirty = true;
				continue;
			}
			const outcome = yield* removeOne(
				deps,
				store,
				note,
				endedAt,
				canvases,
			);
			if (outcome === "Busy" || outcome === "Blocked") return "Withheld";
			released.delete(note.path);
			state.dirty = true;
			if (outcome === "Removed") removed.push(note.path);
		}
		return removed;
	});

	/** One check: answers how long to wait before the next, or undefined once done. */
	const check = Effect.gen(function* () {
		yield* save;
		if (suspects.size === 0) return undefined;
		if (deps.blockedBy?.() !== undefined) return quietMs;
		if (deps.activity.busyAnywhere()) return quietMs;
		const now = yield* Clock.currentTimeMillis;
		const endedAt = deps.activity.lastEndedAt();
		// A run that just ended may have links its editor has not saved yet.
		if (endedAt !== undefined && now - endedAt < quietMs)
			return quietMs - (now - endedAt);
		if (now - state.changedAt < quietMs)
			return quietMs - (now - state.changedAt);
		// Sync may still be bringing the files that link these Readings.
		if (now - state.dictionaryAt < sweepQuietMs)
			return sweepQuietMs - (now - state.dictionaryAt);
		// A Knowledge run writes into its Reading: the check waits it out.
		if ((yield* deps.knowledge?.running ?? Effect.succeed(0)) > 0)
			return quietMs;
		yield* deps.links.settled;
		state.again = false;
		const asked = [...suspects];
		suspects.clear();
		const checked = yield* deps.store.pipe(
			Effect.flatMap((store) => reap(store, asked, endedAt)),
			Effect.catchCause((cause) =>
				Cause.hasInterruptsOnly(cause)
					? Effect.failCause(interruptsOf(cause))
					: Effect.logWarning(
							"[Classify] Checking which Readings no link names failed:",
							cause,
						).pipe(Effect.as(undefined)),
			),
		);
		yield* save;
		if (checked === "Withheld") {
			for (const path of asked)
				if (released.has(path)) suspects.add(path);
			return quietMs;
		}
		if (checked && checked.length > 0)
			yield* Effect.logInfo(
				`[Classify] Removed ${checked.length} Readings no Attestation or link names: ${checked.join(", ")}`,
			);
		if (state.again || suspects.size > 0 || state.dirty) return quietMs;
		return undefined;
	});

	/** Which check fiber is the current one. */
	let generation = 0;

	/** Sleeps out a quiet period, then checks, until nothing is left to do. */
	const checks = (mine: number) =>
		Effect.gen(function* () {
			let wait = quietMs;
			for (;;) {
				state.waiting = true;
				yield* Effect.sleep(wait);
				state.waiting = false;
				const next = yield* check;
				if (next !== undefined) {
					wait = next;
					continue;
				}
				// In one step with `schedule`'s, so nothing asked meanwhile is lost.
				const done = yield* Effect.sync(() => {
					if (state.again || state.dirty || suspects.size > 0)
						return false;
					state.scheduled = false;
					return true;
				});
				if (done) return;
				wait = quietMs;
			}
		}).pipe(
			Effect.ensuring(
				Effect.sync(() => {
					if (generation !== mine) return;
					state.waiting = false;
					state.scheduled = false;
				}),
			),
		);

	/**
	 * Something changed: a sleeping check sees it when it wakes, a running
	 * one runs once more, and with none, one starts if anything is to do.
	 */
	const schedule = Effect.suspend(() => {
		if (closed()) return Effect.void;
		if (state.scheduled) {
			if (!state.waiting) state.again = true;
			return Effect.void;
		}
		if (!state.dirty && suspects.size === 0) return Effect.void;
		state.scheduled = true;
		generation++;
		return FiberHandle.run(handle, track(checks(generation))).pipe(
			Effect.asVoid,
		);
	});

	const changedNow = Effect.flatMap(Clock.currentTimeMillis, (now) =>
		Effect.sync(() => {
			state.changedAt = now;
		}),
	);

	/**
	 * The notes under `Worter/` the file at `path` links now. One holding a
	 * link that resolves to nothing but looks like one into `Worter/` still
	 * links what it linked before.
	 */
	const linksNow = (
		path: string,
		before: ReadonlySet<string> | undefined,
	) => {
		const now = worterTargets(deps.links.resolvedLinks()[path]);
		const unresolved = Object.keys(
			deps.links.unresolvedLinks()[path] ?? {},
		);
		if (before && unresolved.some(looksLikeWorter))
			for (const target of before) now.add(target);
		return now;
	};

	/** Keeps `targets` as the file at `path`'s links. */
	const record = (path: string, targets: Set<string>) => {
		if (targets.size > 0) linksOf.set(path, targets);
		else linksOf.delete(path);
		state.dirty = true;
	};

	const changed = (change: LinkChange) =>
		Effect.suspend(() => {
			if (!state.started) return Effect.void;
			if (change._tag === "Resolved") {
				if (!isSource(change.path)) return Effect.void;
				const before = linksOf.get(change.path);
				const now = linksNow(change.path, before);
				record(change.path, now);
				// The file is there and resolved, and no longer links these.
				for (const target of before ?? [])
					if (!now.has(target)) {
						released.add(target);
						suspects.add(target);
					}
			} else if (change._tag === "Deleted") {
				// A file's absence removes nothing: its links are forgotten.
				for (const source of [...linksOf.keys()])
					if (
						renamedPath(source, change.path, change.path) !==
						undefined
					)
						linksOf.delete(source);
				for (const path of [...released])
					if (
						renamedPath(path, change.path, change.path) !==
						undefined
					)
						released.delete(path);
				state.dirty = true;
			} else {
				const { from, to } = change;
				const moved = new Map<string, Set<string>>();
				for (const [source, targets] of linksOf) {
					const next = new Set(
						[...targets].map(
							(target) => renamedPath(target, from, to) ?? target,
						),
					);
					const at = renamedPath(source, from, to) ?? source;
					// A file moved into `Worter/` is forgotten, and removes nothing.
					if (isSource(at)) moved.set(at, next);
				}
				linksOf.clear();
				for (const [source, targets] of moved)
					linksOf.set(source, targets);
				for (const path of [...released]) {
					const at = renamedPath(path, from, to);
					if (at === undefined) continue;
					released.delete(path);
					released.add(at);
				}
				state.dirty = true;
			}
			return changedNow.pipe(Effect.andThen(schedule));
		});

	const suspect = (paths: readonly string[]) =>
		Effect.suspend(() => {
			const asked = paths.filter((path) => released.has(path));
			for (const path of asked) suspects.add(path);
			return asked.length === 0
				? Effect.void
				: changedNow.pipe(Effect.andThen(schedule));
		});

	const modified = (paths: readonly string[]) =>
		Effect.gen(function* () {
			if (
				paths.some(
					(path) =>
						path.toLowerCase().endsWith(".md") && inWorter(path),
				)
			)
				state.dictionaryAt = yield* Clock.currentTimeMillis;
		});

	const start = Effect.gen(function* () {
		if (state.started || closed()) return;
		yield* deps.links.settled;
		const saved = yield* deps.index.load;
		linksOf.clear();
		released.clear();
		for (const [source, targets] of Object.entries(saved?.links ?? {}))
			if (isSource(source)) linksOf.set(source, new Set(targets));
		for (const path of saved?.released ?? []) released.add(path);
		// The files there now: what they link now is what they link. A file
		// not there keeps what it was last seen linking.
		const resolved = deps.links.resolvedLinks();
		for (const source in resolved)
			if (isSource(source))
				record(source, linksNow(source, linksOf.get(source)));
		state.started = true;
		state.dirty = true;
		yield* save;
	}).pipe(track, Effect.withSpan("ReadingLifetime.start"));

	/** Every Reading with no Attestation and no link, as the check reads them. */
	const unlinked = Effect.gen(function* () {
		yield* deps.links.settled;
		const store = yield* deps.store;
		const canvases = yield* deps.links.canvasLinks;
		return unlinkedAmong(
			yield* store.readingNotes,
			linkedNow(deps.links.resolvedLinks(), canvases),
		);
	}).pipe(
		Effect.catchCause((cause) =>
			Cause.hasInterruptsOnly(cause)
				? Effect.failCause(interruptsOf(cause))
				: Effect.logWarning(
						"[Classify] Could not list the unlinked Readings:",
						cause,
					).pipe(Effect.as([])),
		),
	);

	/** Removes each still unlinked, each in its own transaction under the same guards. */
	const removeUnlinked = (paths: readonly string[]) =>
		Effect.gen(function* () {
			yield* deps.links.settled;
			const store = yield* deps.store;
			const canvases = yield* deps.links.canvasLinks;
			const wanted = new Set(paths);
			const endedAt = deps.activity.lastEndedAt();
			const removed: string[] = [];
			const kept: string[] = [];
			for (const note of (yield* store.readingNotes).filter(({ path }) =>
				wanted.has(path),
			)) {
				const outcome = yield* removeOne(
					deps,
					store,
					note,
					endedAt,
					canvases,
				);
				(outcome === "Removed" ? removed : kept).push(note.path);
				if (outcome === "Removed" && released.delete(note.path))
					state.dirty = true;
			}
			yield* save;
			return { kept, removed } satisfies CleanedUp;
		}).pipe(
			Effect.catchCause((cause) =>
				Cause.hasInterruptsOnly(cause)
					? Effect.failCause(interruptsOf(cause))
					: Effect.logWarning(
							"[Classify] Cleaning up the unlinked Readings failed:",
							cause,
						).pipe(Effect.as({ kept: [...paths], removed: [] })),
			),
			track,
		);

	return {
		changed,
		modified,
		removeUnlinked,
		start,
		suspect,
		unlinked,
		whenIdle: SubscriptionRef.changes(pending).pipe(
			Stream.filter((count) => count === 0),
			Stream.runHead,
			Effect.asVoid,
		),
	};
});
