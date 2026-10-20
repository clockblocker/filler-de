/**
 * Background Knowledge generation (#64): one interruptible fiber per
 * Reading. Classify returns as soon as its links are written; each
 * Reading's Knowledge runs on here, and the user hears how it ended. An
 * occurrence of a Reading whose run is still going joins that run instead
 * of starting another, a click on a link to a note whose Knowledge is
 * still running waits for it and then scrolls to the Reading
 * (`awaitNote`), and `cancelAll` or unloading the plugin interrupts every
 * run, which keeps whatever it already published.
 */
import { readingIdentityKey } from "dumling";
import { Cause, Effect, Exit, Fiber } from "effect";
import { getErrorMessage } from "../../../utils/get-error-message";
import { logger } from "../../../utils/logger";
import type { KnowledgeJob } from "./knowledge-types";
import type { KnowledgeOutcome } from "./produce-knowledge";

export type KnowledgeQueue = {
	/** Starts the Reading's run unless one is already going. */
	readonly enqueue: (job: KnowledgeJob) => void;
	/**
	 * Waits for the runs on the note at `lemmaPath` (`.md` optional) and
	 * answers the Reading block of the last one that finished, or undefined
	 * when none was running.
	 */
	readonly awaitNote: (lemmaPath: string) => Promise<string | undefined>;
	/** Interrupts every run; answers how many there were. */
	readonly cancelAll: () => number;
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

function describeOutcome(
	job: KnowledgeJob,
	exit: Exit.Exit<KnowledgeOutcome, unknown>,
): string | undefined {
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
			return `⚠ Knowledge for ${job.label} saved without ${missing.join(", ")}; Classify it again to retry`;
		return `✓ Knowledge for ${job.label} saved`;
	}
	if (Cause.hasInterruptsOnly(exit.cause)) return undefined;
	const error = Cause.squash(exit.cause);
	logger.warn(
		`[Classify] Knowledge for ${job.label} failed:`,
		Cause.pretty(exit.cause),
	);
	return `⚠ Knowledge for ${job.label} failed: ${getErrorMessage(error)}`;
}

export function createKnowledgeQueue(
	options: KnowledgeQueueOptions,
): KnowledgeQueue {
	const runs = new Map<string, Running>();

	const enqueue = (job: KnowledgeJob) => {
		const key = readingIdentityKey(job.reading);
		if (runs.has(key)) return;
		options.onStart?.();
		const fiber = Effect.runFork(options.run(job));
		const done = Effect.runPromise(Fiber.await(fiber)).then((exit) => {
			runs.delete(key);
			try {
				const message = describeOutcome(job, exit);
				if (message) options.notify(message);
			} finally {
				options.onEnd?.();
			}
		});
		runs.set(key, { done, fiber, job });
	};

	return {
		awaitNote: async (lemmaPath) => {
			const path = notePath(lemmaPath);
			let blockId: string | undefined;
			for (;;) {
				const pending = [...runs.values()].filter(
					({ job }) => notePath(job.lemmaPath) === path,
				);
				if (pending.length === 0) return blockId;
				blockId = pending.at(-1)?.job.readingBlockId;
				await Promise.all(pending.map(({ done }) => done));
			}
		},
		cancelAll: () => {
			const count = runs.size;
			for (const { fiber } of runs.values())
				Effect.runFork(Fiber.interrupt(fiber));
			return count;
		},
		enqueue,
		running: () => runs.size,
		whenIdle: async () => {
			while (runs.size > 0)
				await Promise.all([...runs.values()].map(({ done }) => done));
		},
	};
}
