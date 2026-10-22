import { describe, expect, test } from "bun:test";
import { createDumdictPlanner } from "dumdict/planning";
import type * as Dumling from "dumling/types";
import { Effect, Result } from "effect";
import {
	DictionaryTransactionConflict,
	type DictionaryView,
	DictionaryWriteError,
	Transaction,
} from "../src";
import { run } from "./support/files";
import {
	contribute,
	createLemma,
	createReading,
	gehen,
	gehenReading,
	readingEntry,
	readingOf,
} from "./support/fixtures";
import { lemmaPath, readingPath } from "./support/paths";
import { openStore, seed } from "./support/store";

const planner = createDumdictPlanner("de");
const gehenPath = lemmaPath(gehen);

/** Plans a new Reading of gehen from the view, as Classify plans a New. */
function addReading(view: DictionaryView, reading: Dumling.Reading<"de">) {
	const request = {
		draft: {
			note: { attestationLinks: [], attestedTranslations: [], notes: "" },
			reading,
		},
	};
	return Result.flatMap(
		view.loadReadingEntryContext(
			planner.contextRequest({ intent: "addNewNote", request }),
		),
		(context) => {
			if (context.intent !== "addNewNote")
				throw new Error("Expected addNewNote");
			const outcome = planner.addNewNote(context, request);
			if (outcome.status !== "planned")
				throw new Error(JSON.stringify(outcome));
			return Result.succeed(Transaction.commit(outcome.plan, reading));
		},
	);
}

/** gehen with one Reading, so a new Reading rewrites its Lemma note. */
async function gehenDictionary() {
	const opened = await openStore();
	await seed(opened.store, [
		createLemma(gehen),
		createReading(readingEntry(gehenReading)),
	]);
	return opened;
}

/** A line typed under the Lemma note's header, above its metadata. */
const typedInto = (content: string | undefined, line: string) => {
	const [header, ...rest] = (content ?? "").split("\n");
	return [header, line, ...rest].join("\n");
};

const emojisOf = async (
	store: Awaited<ReturnType<typeof openStore>>["store"],
) =>
	((await run(store.lemmaNote(gehen)))?.readings ?? [])
		.map(({ reading }) =>
			"emojiDescription" in reading ? reading.emojiDescription : "",
		)
		.sort();

describe("transact", () => {
	test("concurrent transactions each plan once and lose no update", async () => {
		const { store } = await gehenDictionary();
		const emojis = ["🐌", "🚗", "🛤", "🏁", "🧭"];
		let plans = 0;
		const added = await run(
			Effect.all(
				emojis.map((emoji) =>
					store.transact((view) => {
						plans++;
						return addReading(view, readingOf(gehen, emoji));
					}),
				),
				{ concurrency: "unbounded" },
			),
		);
		expect(added).toHaveLength(emojis.length);
		// Serialized under the lock, no plan was stale: none planned twice.
		expect(plans).toBe(emojis.length);
		expect(await emojisOf(store)).toEqual([...emojis, "🚶"].sort());
	});

	test("an edit made outside the store during the plan plans again, once, and stays", async () => {
		const { store, vault } = await gehenDictionary();
		let plans = 0;
		const added = await run(
			store.transact((view) => {
				plans++;
				if (plans === 1)
					vault.silentWrite(
						gehenPath,
						typedInto(vault.content(gehenPath), "Meine Notiz"),
					);
				return addReading(view, readingOf(gehen, "🐌"));
			}),
		);
		expect(added).toEqual(readingOf(gehen, "🐌"));
		expect(plans).toBe(2);
		expect(vault.content(gehenPath)).toContain("Meine Notiz");
		expect(await emojisOf(store)).toEqual(["🐌", "🚶"].sort());
	});

	test("a conflict that persists stops after maxAttempts, writing nothing", async () => {
		const { store, vault } = await gehenDictionary();
		let plans = 0;
		const failure = await run(
			store.transact(
				(view) => {
					plans++;
					vault.silentWrite(
						gehenPath,
						typedInto(vault.content(gehenPath), `Notiz ${plans}`),
					);
					return addReading(view, readingOf(gehen, "🐌"));
				},
				{ maxAttempts: 3 },
			),
		).catch((error: unknown) => error);
		expect(failure).toBeInstanceOf(DictionaryTransactionConflict);
		expect(failure).toMatchObject({ attempts: 3 });
		expect(plans).toBe(3);
		expect(await emojisOf(store)).toEqual(["🚶"]);
	});

	test("a write that fails for another reason fails the transaction at once", async () => {
		const { store, vault } = await gehenDictionary();
		let plans = 0;
		const gehenNote = readingPath(gehenReading);
		vault.failNextWrite((_action, path) => path === gehenNote, 1000);
		const failure = await run(
			store.transact((view) => {
				plans++;
				return Result.succeed(
					Transaction.commit(
						{
							baseRevision: view.revision,
							changes: [contribute(gehenReading, "to walk")],
						},
						"Defined",
					),
				);
			}),
		).catch((error: unknown) => error);
		expect(failure).toBeInstanceOf(DictionaryWriteError);
		expect(failure).toMatchObject({ externalChange: false });
		expect(plans).toBe(1);
	});

	test("a stop commits nothing, and a plan's failure is the transaction's", async () => {
		const { store, vault } = await gehenDictionary();
		const batches = vault.batches.length;
		const stopped = await run(
			store.transact(() =>
				Result.succeed(Transaction.stop("Stale" as const)),
			),
		);
		expect(stopped).toBe("Stale");
		const failure = await run(
			store.transact(() => Result.fail("refused" as const)),
		).catch((error: unknown) => error);
		expect(failure).toBe("refused");
		expect(vault.batches.length).toBe(batches);
	});

	test("commit and plan again plans from the view its commit leaves, under the same lock", async () => {
		const { store } = await gehenDictionary();
		const revisions: string[] = [];
		const steps = [readingOf(gehen, "🐌"), readingOf(gehen, "🚗")];
		const done = await run(
			store.transact((view) => {
				revisions.push(view.revision);
				const reading = steps[revisions.length - 1];
				if (reading === undefined)
					return Result.succeed(Transaction.stop("both"));
				return Result.map(addReading(view, reading), (step) =>
					step._tag === "Commit"
						? Transaction.commitAndReplan(
								step.plan,
								"adding Readings",
							)
						: Transaction.replan("no plan"),
				);
			}),
		);
		expect(done).toBe("both");
		expect(new Set(revisions).size).toBe(3);
		expect(await emojisOf(store)).toEqual(["🐌", "🚗", "🚶"].sort());
	});
});
