import { describe, expect, it } from "bun:test";
import type * as Dumling from "dumling/types";
import { Deferred, Effect } from "effect";
import { makeKnowledgeQueue } from "../../../../src/commanders/classify/resolution/knowledge-queue";
import type { KnowledgeJob } from "../../../../src/commanders/classify/resolution/knowledge-types";
import type { KnowledgeOutcome } from "../../../../src/commanders/classify/resolution/produce-knowledge";
import { IdleTracker, makeIdleTracker } from "../../../../src/utils/idle-tracker";
import { inScope } from "../../../support/scoped";

const run = <A>(effect: Effect.Effect<A>) => Effect.runPromise(effect);

/** A job for the noun `spelling`, whose Reading note is `Worter/<spelling>.md`. */
const jobFor = (spelling: string, emoji: string): KnowledgeJob => ({
	attestation: {} as Dumling.Attestation<"de">,
	label: `${spelling} ${emoji}`,
	origin: "New",
	reading: {
		emojiDescription: emoji,
		lemma: {
			canonicalForm: spelling,
			coreFeatures: { gender: "Masc" },
			family: "Lexeme",
			kind: "NOUN",
			language: "de",
			unitKind: "Lemma",
		},
		unitKind: "Reading",
	} as unknown as Dumling.Reading<"de">,
	readingPath: `Worter/${emoji} ${spelling}.md`,
	sentence: { segments: [{ text: spelling }], target: [0] },
});

const see = jobFor("See", "🌊");
const hund = jobFor("Hund", "🐕");

const published: KnowledgeOutcome = {
	_tag: "Published",
	changes: 1,
	dropped: 0,
	failures: [],
};

/**
 * A queue whose runs wait at a gate, then write their Reading's label and
 * publish everything they asked for.
 */
async function gatedQueue() {
	const idle = await run(makeIdleTracker);
	const gate = Deferred.makeUnsafe<void>();
	const started: string[] = [];
	const writes: string[] = [];
	const notices: string[] = [];
	const { close, value: queue } = await inScope(
		makeKnowledgeQueue({
			notify: (message) => notices.push(message),
			run: (job) =>
				Effect.sync(() => started.push(job.label)).pipe(
					Effect.andThen(Deferred.await(gate)),
					Effect.andThen(Effect.sync(() => writes.push(job.label))),
					Effect.as(published),
				),
		}).pipe(Effect.provideService(IdleTracker, idle)),
	);
	return {
		close,
		idle,
		notices,
		open: () => run(Deferred.succeed(gate, undefined)),
		queue,
		started,
		writes,
	};
}

describe("Knowledge queue", () => {
	it("cancels two runs on unload, and neither writes nor tells anything", async () => {
		const { close, idle, notices, open, queue, started, writes } =
			await gatedQueue();
		await run(queue.enqueue(see));
		await run(queue.enqueue(hund));
		expect(started).toEqual(["See 🌊", "Hund 🐕"]);
		expect(await run(idle.pending)).toBe(2);

		// The plugin unloads: the Classify Layer's scope closes.
		await close();
		await open();
		await new Promise((resolve) => setTimeout(resolve, 10));
		expect(writes).toEqual([]);
		expect(notices).toEqual([]);
		expect(await run(idle.pending)).toBe(0);
		expect(await run(queue.running)).toBe(0);
		// A Classify that ends after the unload starts no run.
		await run(queue.enqueue(see));
		expect(started).toEqual(["See 🌊", "Hund 🐕"]);
	});

	it("tells the saved runs together once the last one ends", async () => {
		const { notices, open, queue, writes } = await gatedQueue();
		await run(queue.enqueue(see));
		await run(queue.enqueue(hund));
		await open();
		await run(queue.whenIdle);
		expect(writes).toEqual(["See 🌊", "Hund 🐕"]);
		expect(notices).toEqual(["✓ Knowledge saved for 2 Readings: See 🌊, Hund 🐕"]);
	});

	it("waits in awaitNote only for the runs on that note", async () => {
		const { open, queue } = await gatedQueue();
		expect(await run(queue.awaitNote("Worter/🌊 See"))).toBe(false);
		await run(queue.enqueue(see));
		let waited: boolean | undefined;
		const waiting = run(queue.awaitNote("Worter/🌊 See")).then((answer) => {
			waited = answer;
		});
		expect(await run(queue.awaitNote("Worter/🐕 Hund.md"))).toBe(false);
		await new Promise((resolve) => setTimeout(resolve, 10));
		expect(waited).toBeUndefined();
		await open();
		await waiting;
		expect(waited).toBe(true);
	});

	it("tells a failed run on its own, and still the saved one", async () => {
		const notices: string[] = [];
		const { value: queue } = await inScope(
			makeKnowledgeQueue({
				notify: (message) => notices.push(message),
				run: (job) =>
					job === hund
						? Effect.fail(new Error("the store is gone"))
						: Effect.succeed(published),
			}),
		);
		await run(queue.enqueue(see));
		await run(queue.enqueue(hund));
		await run(queue.whenIdle);
		// See's run ended before Hund's began, as the last one going.
		expect(notices).toEqual([
			"✓ Knowledge for See 🌊 saved",
			"⚠ Knowledge for Hund 🐕 failed: Error: the store is gone",
		]);
	});
});
