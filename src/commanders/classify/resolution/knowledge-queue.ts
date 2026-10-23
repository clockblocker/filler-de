/**
 * Background Knowledge generation (#64): one interruptible fiber per
 * Reading, in a `FiberMap` keyed by the Reading's identity and held by the
 * scope the queue is made in. Classify returns as soon as its links are
 * written; each Reading's Knowledge runs on here, and the user hears how it
 * ended. An occurrence of a Reading whose run is still going joins that run
 * instead of starting another, a click on a link to a note whose Knowledge
 * is still running waits for it and then opens the Reading note again
 * (`awaitNote`, `createReadingReopener`), and `cancelAll` interrupts every
 * run, which keeps whatever it already published. Closing the scope, as
 * the plugin unloads, interrupts every run and tells nothing.
 */
import { VaultPath } from "@textfresser/vault-action-manager";
import { formatCause } from "@textfresser/vault-action-manager/diagnostics";
import { readingIdentityKey } from "dumling";
import {
	Cause,
	Effect,
	Exit,
	FiberMap,
	type Scope,
	Stream,
	SubscriptionRef,
} from "effect";
import { IdleTracker } from "../../../utils/idle-tracker";
import { RETRIED_ASPECTS } from "./knowledge-request";
import type { KnowledgeJob } from "./knowledge-types";
import { tellUser } from "./notify";
import type { KnowledgeOutcome } from "./produce-knowledge";

export type KnowledgeQueue = {
	/** Starts the Reading's run unless one is already going. */
	readonly enqueue: (job: KnowledgeJob) => Effect.Effect<void>;
	/**
	 * Starts the runs of one Classify's Readings, as `enqueue` does each.
	 * They are claimed together first, so the saved ones are told together
	 * even when one ends as soon as it starts.
	 */
	readonly enqueueAll: (jobs: readonly KnowledgeJob[]) => Effect.Effect<void>;
	/**
	 * Waits for the runs on the Reading note at `path` (`.md` optional) and
	 * answers whether any was running.
	 */
	readonly awaitNote: (path: string) => Effect.Effect<boolean>;
	/**
	 * Interrupts every run; answers how many there were, without waiting
	 * for them to stop. A run stops asking dumgen at once; a publication it
	 * already started finishes first.
	 */
	readonly cancelAll: Effect.Effect<number>;
	/** Ends once no run is going. */
	readonly whenIdle: Effect.Effect<void>;
	readonly running: Effect.Effect<number>;
};

export type KnowledgeQueueOptions<E> = {
	readonly run: (job: KnowledgeJob) => Effect.Effect<KnowledgeOutcome, E>;
	/** Shows the user a notice; until #229, Obsidian's `Notice`. */
	readonly notify: (message: string) => void;
};

type QueueState = {
	/** The Readings whose run is going, by `readingIdentityKey`. */
	readonly running: ReadonlyMap<string, KnowledgeJob>;
	/** The runs that saved everything they asked for, told together once none is going. */
	readonly saved: readonly string[];
	/** The queue's scope is closing: no run starts, and nothing is told. */
	readonly closing: boolean;
};

const notePath = (path: string) => (path.endsWith(".md") ? path : `${path}.md`);

/** A run that saved everything it asked for; told together once the queue is idle. */
const SAVED = Symbol("saved");

function describeOutcome<E>(
	job: KnowledgeJob,
	exit: Exit.Exit<KnowledgeOutcome, E>,
): string | typeof SAVED | undefined {
	if (Exit.isSuccess(exit)) {
		const outcome = exit.value;
		if (outcome._tag === "Covered") return undefined;
		const missing = [
			...new Set(
				outcome.failures.map(({ aspect, leaf }) =>
					leaf ? `${aspect}/${leaf}` : aspect,
				),
			),
		];
		if (missing.length > 0)
			return `⚠ Knowledge for ${job.label} saved without ${missing.join(", ")}${outcome.failures.some(({ aspect }) => RETRIED_ASPECTS.has(aspect)) ? "; Classify it again to retry" : ""}`;
		return SAVED;
	}
	// Its run logged the failure, in its fiber.
	if (Cause.hasInterruptsOnly(exit.cause)) return undefined;
	return `⚠ Knowledge for ${job.label} failed: ${formatCause(exit.cause, { stack: false })}`;
}

const savedNotice = (labels: readonly string[]) =>
	labels.length === 1
		? `✓ Knowledge for ${labels[0]} saved`
		: `✓ Knowledge saved for ${labels.length} Readings: ${labels.join(", ")}`;

/**
 * The queue, in the current scope. Each run forks from the fiber that
 * enqueues it, so it is traced under the Classify that asked for it, and
 * the plugin's idle tracker counts it until it has told how it ended.
 */
export const makeKnowledgeQueue = Effect.fnUntraced(function* <E>(
	options: KnowledgeQueueOptions<E>,
): Effect.fn.Return<KnowledgeQueue, never, Scope.Scope> {
	const idle = yield* IdleTracker;
	const runs = yield* FiberMap.make<string, void>();
	const state = yield* SubscriptionRef.make<QueueState>({
		closing: false,
		running: new Map(),
		saved: [],
	});
	// Added after the map, so it runs before the map interrupts the runs.
	yield* Effect.addFinalizer(() =>
		SubscriptionRef.update(state, (current) => ({
			...current,
			closing: true,
		})),
	);
	const tell = tellUser(options.notify);

	/** The run ended: told as it ended, and with the saved ones once it was the last. */
	const ended = (
		key: string,
		job: KnowledgeJob,
		exit: Exit.Exit<KnowledgeOutcome, E>,
	) =>
		Effect.gen(function* () {
			const message = describeOutcome(job, exit);
			const { closing, told } = yield* SubscriptionRef.modify(
				state,
				(current) => {
					const running = new Map(current.running);
					running.delete(key);
					const saved =
						message === SAVED
							? [...current.saved, job.label]
							: current.saved;
					const last = running.size === 0;
					return [
						{ closing: current.closing, told: last ? saved : [] },
						{
							closing: current.closing,
							running,
							saved: last ? [] : saved,
						},
					];
				},
			);
			if (closing) return;
			if (message !== SAVED && message !== undefined)
				yield* tell(message);
			if (told.length > 0) yield* tell(savedNotice(told));
		});

	/** Forks the claimed Reading's run into the map. */
	const start = (key: string, job: KnowledgeJob) =>
		FiberMap.run(
			runs,
			key,
			Effect.suspend(() => options.run(job)).pipe(
				Effect.tapCause((cause) =>
					Cause.hasInterruptsOnly(cause)
						? Effect.void
						: Effect.logWarning(
								`[Classify] Knowledge for ${job.label} failed:`,
								cause,
							),
				),
				Effect.onExit((exit) => ended(key, job, exit)),
				Effect.ignore,
				idle.track,
				Effect.withSpan("KnowledgeQueue.run", {
					attributes: { "knowledge.reading": job.label },
				}),
			),
		);

	const enqueueAll = (jobs: readonly KnowledgeJob[]) =>
		Effect.gen(function* () {
			const starting = yield* SubscriptionRef.modify(
				state,
				(current): [[string, KnowledgeJob][], QueueState] => {
					if (current.closing) return [[], current];
					const running = new Map(current.running);
					const claimed: [string, KnowledgeJob][] = [];
					for (const job of jobs) {
						const key = readingIdentityKey(job.reading);
						if (running.has(key)) continue;
						running.set(key, job);
						claimed.push([key, job]);
					}
					return [claimed, { ...current, running }];
				},
			);
			for (const [key, job] of starting) yield* start(key, job);
		});

	/** Ends once no job `pending` keeps is running. */
	const settled = (pending: (job: KnowledgeJob) => boolean) =>
		Effect.gen(function* () {
			const some = (current: QueueState) =>
				[...current.running.values()].some(pending);
			if (!some(yield* SubscriptionRef.get(state))) return false;
			yield* SubscriptionRef.changes(state).pipe(
				Stream.filter((current) => !some(current)),
				Stream.runHead,
			);
			return true;
		});

	return {
		awaitNote: (readingPath) =>
			Effect.suspend(() => {
				const path = notePath(readingPath);
				return settled(({ readingPath }) =>
					VaultPath.caseSensitive.same(notePath(readingPath), path),
				);
			}),
		// The runs stop on a fiber of their own, as the caller tells at once.
		cancelAll: Effect.gen(function* () {
			const count = yield* FiberMap.size(runs);
			yield* Effect.forkDetach(FiberMap.clear(runs));
			return count;
		}),
		enqueue: (job) => enqueueAll([job]),
		enqueueAll,
		running: Effect.map(
			SubscriptionRef.get(state),
			({ running }) => running.size,
		),
		whenIdle: Effect.asVoid(settled(() => true)),
	};
});
