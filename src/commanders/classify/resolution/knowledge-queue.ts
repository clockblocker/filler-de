/**
 * Background Knowledge generation (#64): one interruptible fiber per
 * Reading. Classify returns as soon as its links are written; each
 * Reading's Knowledge runs on here, and the user hears how it ended. An
 * occurrence of a Reading whose run is still going joins that run instead
 * of starting another, a click on a link to a note whose Knowledge is
 * still running waits for it and then opens the Reading note again
 * (`awaitNote`, `createReadingReopener`), and `cancelAll` or unloading the
 * plugin interrupts every run, which keeps whatever it already published.
 */
import { VaultPath } from "@textfresser/vault-action-manager";
import { formatCause } from "@textfresser/vault-action-manager/diagnostics";
import { readingIdentityKey } from "dumling";
import { Cause, Effect, Exit, Fiber } from "effect";
import { getErrorMessage } from "../../../utils/get-error-message";
import { logger } from "../../../utils/logger";
import { RETRIED_ASPECTS } from "./knowledge-request";
import type { KnowledgeJob } from "./knowledge-types";
import type { KnowledgeOutcome } from "./produce-knowledge";

export type KnowledgeQueue = {
	/** Starts the Reading's run unless one is already going. */
	readonly enqueue: (job: KnowledgeJob) => void;
	/**
	 * Waits for the runs on the Reading note at `path` (`.md` optional) and
	 * answers whether any was running.
	 */
	readonly awaitNote: (path: string) => Promise<boolean>;
	/**
	 * Interrupts every run; answers how many there were. A run stops asking
	 * dumgen at once; a publication it already started finishes first.
	 */
	readonly cancelAll: () => number;
	/** Cancels every run and starts no new one: the plugin unloads. */
	readonly close: () => void;
	/** Resolves once no run is going. */
	readonly whenIdle: () => Promise<void>;
	readonly running: () => number;
};

export type KnowledgeQueueOptions = {
	readonly run: (
		job: KnowledgeJob,
	) => Effect.Effect<KnowledgeOutcome, unknown>;
	readonly notify: (message: string) => void;
	/** Called as a run starts and ends, so the plugin's idle tracker sees it. */
	readonly onStart?: () => void;
	readonly onEnd?: () => void;
};

type Running = {
	readonly job: KnowledgeJob;
	readonly fiber: Fiber.Fiber<KnowledgeOutcome, unknown>;
	readonly done: Promise<void>;
};

const notePath = (path: string) => (path.endsWith(".md") ? path : `${path}.md`);

/** A run that saved everything it asked for; told together once the queue is idle. */
const SAVED = Symbol("saved");

function describeOutcome(
	job: KnowledgeJob,
	exit: Exit.Exit<KnowledgeOutcome, unknown>,
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
	if (Cause.hasInterruptsOnly(exit.cause)) return undefined;
	logger.warn(
		`[Classify] Knowledge for ${job.label} failed:`,
		formatCause(exit.cause),
	);
	return `⚠ Knowledge for ${job.label} failed: ${formatCause(exit.cause, { stack: false })}`;
}

export function createKnowledgeQueue(
	options: KnowledgeQueueOptions,
): KnowledgeQueue {
	const runs = new Map<string, Running>();
	const saved: string[] = [];
	let closed = false;
	const notify = (message: string) => {
		try {
			options.notify(message);
		} catch (error) {
			logger.warn(
				"[Classify] Could not show a notice:",
				getErrorMessage(error),
			);
		}
	};

	const enqueue = (job: KnowledgeJob) => {
		const key = readingIdentityKey(job.reading);
		if (closed || runs.has(key)) return;
		options.onStart?.();
		const fiber = Effect.runFork(Effect.suspend(() => options.run(job)));
		const done = Effect.runPromise(Fiber.await(fiber))
			.then((exit) => {
				runs.delete(key);
				const message = describeOutcome(job, exit);
				if (message === SAVED) saved.push(job.label);
				else if (message) notify(message);
				if (runs.size === 0 && saved.length > 0) {
					const labels = saved.splice(0);
					notify(
						labels.length === 1
							? `✓ Knowledge for ${labels[0]} saved`
							: `✓ Knowledge saved for ${labels.length} Readings: ${labels.join(", ")}`,
					);
				}
			})
			.finally(() => options.onEnd?.());
		runs.set(key, { done, fiber, job });
	};

	const cancelAll = () => {
		const count = runs.size;
		for (const { fiber } of runs.values())
			Effect.runFork(Fiber.interrupt(fiber));
		return count;
	};

	return {
		awaitNote: async (readingPath) => {
			const path = notePath(readingPath);
			let waited = false;
			for (;;) {
				const pending = [...runs.values()].filter(({ job }) =>
					VaultPath.caseSensitive.same(
						notePath(job.readingPath),
						path,
					),
				);
				if (pending.length === 0) return waited;
				waited = true;
				await Promise.all(pending.map(({ done }) => done));
			}
		},
		cancelAll,
		close: () => {
			closed = true;
			cancelAll();
		},
		enqueue,
		running: () => runs.size,
		whenIdle: async () => {
			while (runs.size > 0)
				await Promise.all([...runs.values()].map(({ done }) => done));
		},
	};
}
