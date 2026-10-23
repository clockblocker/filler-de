import { describe, expect, it } from "bun:test";
import {
	SplitPathKind,
	type SplitPathToFolder,
} from "@textfresser/vault-action-manager";
import { Deferred, Effect } from "effect";
import type { DelimiterChangeService } from "../../../src/commanders/librarian/runtime/delimiter-change-service";
import { planDelimiterMigration } from "../../../src/commanders/librarian/runtime/delimiter-migration-plan";
import { createLifecycleNotices } from "../../../src/lifecycle/lifecycle-notices";
import {
	createLifecycleSupervisor,
	type SupervisedLibrarian,
} from "../../../src/lifecycle/lifecycle-supervisor";
import { changeDelimiter } from "../../../src/plugin/delimiter-migration";
import type { SuffixDelimiterConfig } from "../../../src/types";

const oldConfig = { padded: false, symbol: "-" } satisfies SuffixDelimiterConfig;
const newConfig = { padded: true, symbol: "~" } satisfies SuffixDelimiterConfig;
const root: SplitPathToFolder = {
	basename: "Library",
	kind: SplitPathKind.Folder,
	pathParts: [],
};
const plan = planDelimiterMigration({
	candidates: [
		{
			basename: "alpha-beta",
			extension: "md",
			kind: SplitPathKind.MdFile,
			pathParts: ["Library"],
		},
	],
	libraryRoot: root,
	newConfig,
	oldConfig,
});

const settle = async () => {
	for (let round = 0; round < 5; round++)
		await new Promise((resolve) => setTimeout(resolve, 0));
};

type Fake = SupervisedLibrarian & {
	readonly id: number;
	subscribed: boolean;
	delimiter: string;
};

/**
 * A plugin whose Librarians start under the delimiter in effect, failing
 * while `failStarts` is above zero, and whose files rename at once.
 */
function makeHarness() {
	const events: string[] = [];
	const shown: { message: string; sticky: boolean }[] = [];
	const librarians: Fake[] = [];
	let delimiter = oldConfig.symbol;
	let failStarts = 0;
	let holdNextStart: Deferred.Deferred<void> | null = null;

	const notices = createLifecycleNotices(
		(message, { sticky }) => {
			shown.push({ message, sticky });
		},
		{ writeStop: () => {} },
	);
	const supervisor = createLifecycleSupervisor<Fake>({ notices });
	const service = {
		execute: () =>
			Effect.sync(() => {
				events.push("execute");
				return {
					kind: "Completed" as const,
					renamedCount: plan.actions.length,
					succeeded: plan.actions,
				};
			}),
		plan: () =>
			Effect.sync(() => {
				events.push("plan");
				return plan;
			}),
	} as unknown as DelimiterChangeService;

	const launched = Effect.runPromise(
		supervisor.launch(
			Effect.succeed({
				attachLibrarian: () => () => undefined,
				loadStore: () => Promise.resolve(),
				makeLibrarian: (onStopped) => {
					const id = librarians.length;
					const fake: Fake = {
						delimiter,
						id,
						init: () =>
							Effect.gen(function* () {
								events.push(`init ${id} under ${delimiter}`);
								fake.subscribed = true;
								const hold = holdNextStart;
								holdNextStart = null;
								if (hold) yield* Deferred.await(hold);
								if (failStarts > 0) {
									failStarts--;
									fake.subscribed = false;
									const cause = new Error("disk full");
									onStopped({ kind: "Stopped", message: "Librarian notice" });
									return yield* Effect.fail(cause);
								}
							}),
						subscribed: false,
						unsubscribe: () =>
							Effect.sync(() => {
								events.push(`unsubscribe ${id}`);
								fake.subscribed = false;
							}),
					};
					librarians.push(fake);
					return fake;
				},
				onLaunched: () => Effect.void,
				resetRunning: () => false,
				sweep: () => undefined,
			}),
		),
	);

	const migrate = () =>
		Effect.runPromise(
			changeDelimiter(
				{
					applyDelimiter: (config) => {
						events.push(`apply ${config.symbol}`);
						delimiter = config.symbol;
					},
					confirm: () => Promise.resolve(true),
					libraryRoot: "Library",
					notices,
					service,
					supervisor,
				},
				oldConfig,
				newConfig,
			),
		);

	return {
		events,
		failNextStarts: (count: number) => {
			failStarts = count;
		},
		holdNextStart: () => {
			holdNextStart = Deferred.makeUnsafe<void>();
			return holdNextStart;
		},
		launched,
		librarians,
		migrate,
		shown,
		subscribed: () =>
			librarians.filter(({ subscribed }) => subscribed).map(({ id }) => id),
		supervisor,
	};
}

describe("changeDelimiter", () => {
	it("pauses the Librarian for the renames and restarts it under the new delimiter", async () => {
		const h = makeHarness();
		await h.launched;

		const report = await h.migrate();

		expect(report.keepsNewDelimiter).toBe(true);
		expect(report.librarianReinitialized).toBe(true);
		expect(h.events).toEqual([
			"init 0 under -",
			"plan",
			"unsubscribe 0",
			"execute",
			"apply ~",
			"init 1 under ~",
		]);
		expect(h.subscribed()).toEqual([1]);
		expect(h.shown).toEqual([
			{ message: 'Renamed 1 file(s) to use " ~ ".', sticky: false },
		]);
	});

	it("waits for a restart in flight before it plans", async () => {
		const h = makeHarness();
		await h.launched;
		const hold = h.holdNextStart();
		const restart = Effect.runPromise(h.supervisor.restart);
		await settle();

		const migration = h.migrate();
		await settle();
		expect(h.events).not.toContain("plan");

		Deferred.doneUnsafe(hold, Effect.void);
		await restart;
		await migration;
		expect(h.events).toEqual([
			"init 0 under -",
			"unsubscribe 0",
			"init 1 under -",
			"plan",
			"unsubscribe 1",
			"execute",
			"apply ~",
			"init 2 under ~",
		]);
		expect(h.subscribed()).toEqual([2]);
	});

	it("tries the restart once more, and reports a plain completion when that works", async () => {
		const h = makeHarness();
		await h.launched;
		h.failNextStarts(1);

		const report = await h.migrate();

		expect(report.keepsNewDelimiter).toBe(true);
		expect(report.librarianReinitialized).toBe(true);
		expect(h.subscribed()).toEqual([2]);
		expect(h.shown).toEqual([
			{ message: 'Renamed 1 file(s) to use " ~ ".', sticky: false },
		]);
	});

	it("tells a restart that failed twice in one sticky notice quoting why, without the Librarian's own", async () => {
		const h = makeHarness();
		await h.launched;
		h.failNextStarts(2);

		const report = await h.migrate();

		expect(report.keepsNewDelimiter).toBe(true);
		// The settings save must not restart it a third time.
		expect(report.librarianReinitialized).toBe(true);
		expect(h.shown).toHaveLength(1);
		expect(h.shown[0]?.sticky).toBe(true);
		expect(h.shown[0]?.message).toContain("the Librarian did not restart");
		expect(h.shown[0]?.message).toContain("disk full");
		expect(h.shown[0]?.message).not.toContain("Librarian notice");
		expect(h.supervisor.librarianState().kind).toBe("Failed");
	});

	it("reports a lifecycle that unloaded before it began as a change that renamed nothing", async () => {
		const h = makeHarness();
		await h.launched;
		await Effect.runPromise(h.supervisor.stop);

		const report = await h.migrate();

		expect(report.keepsNewDelimiter).toBe(false);
		expect(h.events).not.toContain("plan");
		expect(h.shown).toEqual([]);
	});
});
