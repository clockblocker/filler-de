/**
 * How long a Reading lives (#281): while it has an Attestation, or while a
 * link from a Markdown file outside `Worter/` points at its Reading note,
 * as Obsidian last resolved the vault's links (`resolvedLinks`). Classify
 * links every unit and commits its Reading with no Attestation; a click
 * adds one; removing an Attestation keeps the Reading it empties
 * (`emptyReading: "Keep"`). A Reading with neither goes with dumdict's
 * `removeReading`, and its cascade: its Surfaces no other link names, its
 * Lemma with its last Reading, and the claims on them. The store follows a
 * removed Lemma with the Shadow re-evaluation, the Breakdown and Source
 * re-pointing, the Formations and the Crossroad notes, as it follows any
 * commit that removes one.
 *
 * Which Readings are checked, so no check reads the whole dictionary:
 *
 * - **Links that went.** The lifetime keeps each file's links to notes
 *   under `Worter/`, as Obsidian last resolved them. Obsidian tells it each
 *   file it resolved again, each one deleted and each one renamed
 *   (`LinkChange`); a note a file no longer links, every note a deleted
 *   file linked, and every note a file moved into `Worter/` linked, is
 *   checked, and so is a Reading note that was renamed.
 * - **Attestations that went.** The unlink observer tells it the Reading
 *   notes whose Attestations it removed (`suspect`).
 * - **The startup sweep.** Links removed while the plugin was not running
 *   reach no event, so once the dictionary is ready, and Obsidian has
 *   resolved every file's links, it checks every Reading with no
 *   Attestation (`sweep`).
 *
 * What keeps a removal from being false:
 *
 * - **Resolved links.** Nothing is judged until Obsidian has resolved the
 *   links of every file it is indexing (`NoteLinks.settled`), so a note
 *   still loading at startup, or a file saved a moment ago, is read with
 *   its links.
 * - **Quiet period.** A link cut from one note and pasted into another is
 *   in flux: a check runs only once no link has changed for `quietMs`.
 * - **Classify runs and clicks.** A run commits each unit's Reading before
 *   it writes the link to it, into a Scroll the lifetime cannot tell in
 *   advance, deciding and committing under its Lemma's lock; a click
 *   attests through such a run. Both count as Scroll activity. No check
 *   runs while a run goes on any Scroll, within `quietMs` of the last one
 *   ending, while the editor saves its links, or while a Knowledge run a
 *   click asked for is going. Each removal is a
 *   store transaction whose plan, under the lock Classify's commits take,
 *   removes nothing when a run is going on, one ended since the check
 *   began, or a dictionary reset holds Classify, and the check runs again.
 *   The plan also reads the Reading and the links again: one that gained
 *   an Attestation or a link meanwhile stays.
 * - **Dictionary Sync.** Sync can bring Readings ahead of the Scrolls that
 *   link them, so no check runs until no dictionary note has been modified
 *   from outside for `sweepQuietMs`, and the sweep waits until no Markdown
 *   file has.
 *
 * A link counts from any Markdown file outside `Worter/`, a Scroll or not;
 * links between dictionary notes never do.
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
import type { ScrollActivity } from "./scroll-activity";

/** How long no link may change before a check runs. */
const LIFETIME_QUIET_MS = 5_000;

/** How many quiet periods no dictionary note, and for the sweep no Markdown file, may be modified. */
const SWEEP_QUIET_PERIODS = 3;

/** Each Markdown file's links to notes, by path, with how often it links each. */
type ResolvedLinks = Readonly<Record<string, Readonly<Record<string, number>>>>;

/** Obsidian's link index, as the lifetime reads it. */
export type NoteLinks = {
	/**
	 * Every file's resolved links (`MetadataCache.resolvedLinks`). Read
	 * synchronously, as a store transaction's plan reads it under the
	 * store's lock.
	 */
	readonly resolvedLinks: () => ResolvedLinks;
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
	readonly activity: Pick<ScrollActivity, "busyAnywhere" | "lastEndedAt">;
	/** Classify's Knowledge runs: no check runs while one is going. */
	readonly knowledge?: Pick<KnowledgeQueue, "running">;
	/** Why no Reading may be removed now, such as a dictionary reset. */
	readonly blockedBy?: () => string | undefined;
	readonly quietMs?: number;
	/**
	 * How long no dictionary note, and for the sweep no Markdown file, may
	 * be modified from outside before a check runs.
	 */
	readonly sweepQuietMs?: number;
};

export type ReadingLifetime = {
	/** Obsidian resolved a file's links again, deleted one, or renamed one. */
	readonly changed: (change: LinkChange) => Effect.Effect<void>;
	/** The Reading notes at these paths may have lost their last Attestation. */
	readonly suspect: (paths: readonly string[]) => Effect.Effect<void>;
	/** Tells the lifetime these Markdown files were modified from outside, as VAM reports them. */
	readonly modified: (paths: readonly string[]) => Effect.Effect<void>;
	/**
	 * Checks every Reading with no Attestation, once Obsidian has resolved
	 * every file's links. Run once the dictionary is ready; it does not wait
	 * for the check.
	 */
	readonly sweep: Effect.Effect<void>;
	/** Ends once no check is pending. */
	readonly whenIdle: Effect.Effect<void>;
};

const inWorter = (path: string) =>
	VaultPath.caseSensitive.isUnder(path, WORTER_FOLDER, { inclusive: false });

/** The notes under `Worter/` that `targets` links. */
const worterTargets = (
	targets: Readonly<Record<string, number>> | undefined,
): Set<string> => {
	const found = new Set<string>();
	for (const target in targets)
		if ((targets[target] ?? 0) > 0 && inWorter(target)) found.add(target);
	return found;
};

/** Every note under `Worter/` a Markdown file outside it links. */
const linkedFromOutside = (resolved: ResolvedLinks): Set<string> => {
	const linked = new Set<string>();
	for (const source in resolved) {
		if (inWorter(source)) continue;
		for (const target of worterTargets(resolved[source]))
			linked.add(target);
	}
	return linked;
};

/** Whether a Markdown file outside `Worter/` links the note at `path`. */
const linksTo = (resolved: ResolvedLinks, path: string) => {
	for (const source in resolved)
		if (!inWorter(source) && (resolved[source]?.[path] ?? 0) > 0)
			return true;
	return false;
};

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
 * Plans removing a Reading the check found with no Attestation and no
 * link, under the store's lock, only while that still holds: no Classify
 * run going on and none ended since the check began, no reset holding
 * Classify, and the Reading stored with no Attestation and no link.
 */
const planLifetimeRemoval =
	(
		deps: ReadingLifetimeDeps,
		reading: Dumling.Reading<"de">,
		endedAt: number | undefined,
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
			linksTo(deps.links.resolvedLinks(), location.path)
		)
			return Result.succeed(stopWith("Kept"));
		return planReadingRemoval(view, reading);
	};

type Checked =
	| { readonly _tag: "Withheld" }
	| { readonly _tag: "Done"; readonly removed: readonly string[] };

/**
 * Removes each Reading of `notes` with no Attestation that no file
 * outside `Worter/` links, one transaction each.
 */
const reap = Effect.fnUntraced(function* (
	deps: ReadingLifetimeDeps,
	store: LifetimeStore,
	notes: readonly StoredReadingNote[],
	endedAt: number | undefined,
): Effect.fn.Return<Checked, DictionaryCommitFailed | DictionaryCommitError> {
	const unattested = notes.filter(
		({ entry }) => entry.attestationLinks.length === 0,
	);
	if (unattested.length === 0) return { _tag: "Done", removed: [] };
	// One pass over the vault's links, however many Readings are checked.
	const linked = linkedFromOutside(deps.links.resolvedLinks());
	const removed: string[] = [];
	for (const { entry, path } of unattested) {
		if (linked.has(path)) continue;
		const outcome = yield* store
			.transact(planLifetimeRemoval(deps, entry.reading, endedAt), {
				maxAttempts: MAX_COMMIT_ATTEMPTS,
			})
			.pipe(
				Effect.catchTag("DictionaryTransactionConflict", () =>
					Effect.logWarning(
						`[Classify] Could not remove the Reading ${path}, which no Attestation or link names: the dictionary kept changing`,
					).pipe(Effect.as("Kept" as const)),
				),
			);
		if (outcome === "Removed") removed.push(path);
		else if (outcome !== "Kept") return { _tag: "Withheld" };
	}
	return { _tag: "Done", removed };
});

/**
 * The lifetime, in the current scope. Its check runs on one fiber, in a
 * `FiberHandle`, forked from the fiber that asked for it: it sleeps out
 * the quiet period, then checks. A change while it sleeps replaces it with
 * one that sleeps afresh; one while it checks asks for another check.
 * Every wait is an `Effect.sleep` and every time a `Clock` reading, so a
 * `TestClock` drives it. Closing the scope, as the plugin unloads,
 * interrupts the check.
 */
export const makeReadingLifetime = Effect.fnUntraced(function* <E>(
	deps: ReadingLifetimeDeps<E>,
): Effect.fn.Return<ReadingLifetime, never, Scope.Scope> {
	const quietMs = deps.quietMs ?? LIFETIME_QUIET_MS;
	const sweepQuietMs = deps.sweepQuietMs ?? SWEEP_QUIET_PERIODS * quietMs;
	const idle = yield* IdleTracker;
	const scope = yield* Effect.scope;
	const handle = yield* FiberHandle.make<void>();
	const closed = () => handle.state._tag === "Closed";
	const pending = yield* SubscriptionRef.make(0);

	/** Each file outside `Worter/`'s links to notes under it, as last resolved. */
	const linksOf = new Map<string, Set<string>>();
	/** The Reading notes to check. */
	const suspects = new Set<string>();
	const state = {
		/** Changed while a check ran: check once more. */
		again: false,
		/** Every Reading with no Attestation is to be checked: the sweep asked. */
		all: false,
		/** When a link last changed, or a Reading was suspected. */
		changedAt: Number.NEGATIVE_INFINITY,
		/** When a dictionary note, and any Markdown file, was last modified from outside. */
		dictionaryAt: Number.NEGATIVE_INFINITY,
		/** A check is scheduled or running. */
		scheduled: false,
		vaultAt: Number.NEGATIVE_INFINITY,
		/** The check is sleeping out a quiet period. */
		waiting: false,
	};

	const track = <A, E2, R>(effect: Effect.Effect<A, E2, R>) =>
		Effect.acquireUseRelease(
			SubscriptionRef.update(pending, (n) => n + 1),
			() => effect,
			() => SubscriptionRef.update(pending, (n) => n - 1),
		).pipe(idle.track);

	/** One check: answers how long to wait before the next, or undefined once done. */
	const check = Effect.gen(function* () {
		if (deps.blockedBy?.() !== undefined) return quietMs;
		if (deps.activity.busyAnywhere()) return quietMs;
		const now = yield* Clock.currentTimeMillis;
		const endedAt = deps.activity.lastEndedAt();
		// A run that just ended may have links its editor has not saved yet.
		if (endedAt !== undefined && now - endedAt < quietMs)
			return quietMs - (now - endedAt);
		if (now - state.changedAt < quietMs)
			return quietMs - (now - state.changedAt);
		// Sync may still be bringing the Scrolls that link new Readings.
		if (now - state.dictionaryAt < sweepQuietMs)
			return sweepQuietMs - (now - state.dictionaryAt);
		if (state.all && now - state.vaultAt < sweepQuietMs)
			return sweepQuietMs - (now - state.vaultAt);
		// A Knowledge run writes into its Reading: the check waits it out.
		if ((yield* deps.knowledge?.running ?? Effect.succeed(0)) > 0)
			return quietMs;
		yield* deps.links.settled;
		state.again = false;
		const all = state.all;
		const asked = [...suspects];
		state.all = false;
		suspects.clear();
		const checked = yield* deps.store.pipe(
			Effect.flatMap((store) =>
				store.readingNotes.pipe(
					Effect.flatMap((notes) => {
						const wanted = new Set(asked);
						return reap(
							deps,
							store,
							all
								? notes
								: notes.filter(({ path }) => wanted.has(path)),
							endedAt,
						);
					}),
				),
			),
			Effect.catchCause((cause) =>
				Cause.hasInterruptsOnly(cause)
					? Effect.failCause(interruptsOf(cause))
					: Effect.logWarning(
							"[Classify] Checking which Readings no link names failed:",
							cause,
						).pipe(Effect.as(undefined)),
			),
		);
		if (checked?._tag === "Withheld") {
			// Checked again as a whole once the run or the reset is over.
			if (all) state.all = true;
			for (const path of asked) suspects.add(path);
			return quietMs;
		}
		if (checked && checked.removed.length > 0)
			yield* Effect.logInfo(
				`[Classify] Removed ${checked.removed.length} Readings no Attestation or link names: ${checked.removed.join(", ")}`,
			);
		if (state.again || state.all || suspects.size > 0) return quietMs;
		return undefined;
	});

	/** Which check fiber is the current one. */
	let generation = 0;

	/** Sleeps out a quiet period, then checks, until nothing is left to check. */
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
					if (state.again || state.all || suspects.size > 0)
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
	 * Something changed: a sleeping check sees it when it wakes and sleeps
	 * out the rest of a quiet period, a running one runs once more, and with
	 * none, one starts if anything is to be checked.
	 */
	const schedule = Effect.suspend(() => {
		if (closed()) return Effect.void;
		if (state.scheduled) {
			if (!state.waiting) state.again = true;
			return Effect.void;
		}
		if (!state.all && suspects.size === 0) return Effect.void;
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

	/** The notes the file at `path` links now, kept; answers those it no longer links. */
	const relink = (path: string) => {
		const now = inWorter(path)
			? new Set<string>()
			: worterTargets(deps.links.resolvedLinks()[path]);
		const before = linksOf.get(path);
		if (now.size > 0) linksOf.set(path, now);
		else linksOf.delete(path);
		return [...(before ?? [])].filter((target) => !now.has(target));
	};

	const changed = (change: LinkChange) =>
		Effect.suspend(() => {
			if (change._tag === "Resolved") {
				for (const target of relink(change.path)) suspects.add(target);
			} else if (change._tag === "Deleted") {
				for (const [source, targets] of [...linksOf])
					if (
						renamedPath(source, change.path, change.path) !==
						undefined
					) {
						linksOf.delete(source);
						for (const target of targets) suspects.add(target);
					}
			} else {
				const { from, to } = change;
				for (const [source, targets] of [...linksOf]) {
					const moved = renamedPath(source, from, to);
					if (moved === undefined) continue;
					linksOf.delete(source);
					// A file moved into `Worter/` no longer counts as linking.
					if (inWorter(moved))
						for (const target of targets) suspects.add(target);
					else linksOf.set(moved, targets);
				}
				// A Reading note moved: the links to its old path may not follow.
				if (inWorter(to) && to.endsWith(".md")) suspects.add(to);
			}
			return changedNow.pipe(Effect.andThen(schedule));
		});

	const suspect = (paths: readonly string[]) =>
		Effect.suspend(() => {
			for (const path of paths) suspects.add(path);
			return paths.length === 0
				? Effect.void
				: changedNow.pipe(Effect.andThen(schedule));
		});

	const modified = (paths: readonly string[]) =>
		Effect.gen(function* () {
			if (paths.length === 0) return;
			const now = yield* Clock.currentTimeMillis;
			state.vaultAt = now;
			if (paths.some((path) => path.endsWith(".md") && inWorter(path)))
				state.dictionaryAt = now;
		});

	const sweep = Effect.gen(function* () {
		yield* deps.links.settled;
		const resolved = deps.links.resolvedLinks();
		linksOf.clear();
		for (const source in resolved) {
			if (inWorter(source)) continue;
			const targets = worterTargets(resolved[source]);
			if (targets.size > 0) linksOf.set(source, targets);
		}
		state.all = true;
		yield* schedule;
	}).pipe(
		track,
		Effect.withSpan("ReadingLifetime.sweep"),
		Effect.forkIn(scope, { startImmediately: true }),
		Effect.asVoid,
		(fork) => Effect.suspend(() => (closed() ? Effect.void : fork)),
	);

	return {
		changed,
		modified,
		suspect,
		sweep,
		whenIdle: SubscriptionRef.changes(pending).pipe(
			Stream.filter((count) => count === 0),
			Stream.runHead,
			Effect.asVoid,
		),
	};
});
