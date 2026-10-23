/**
 * The Librarian's state across a restart, over the real Vault Action
 * Manager and the real lifecycle supervisor. Each start is a new Librarian
 * in a scope of its own; its state is one value, and work reaches it only
 * once it runs. A bulk event delivered during a restart is handled by the
 * new Librarian or not at all, never by one that is half started.
 */
import { describe, expect, it } from "bun:test";
import {
	type BulkVaultEvent,
	createVaultActionManager,
	splitPathCodec,
	type VaultAction,
	VaultActionKind,
	VaultEventKind,
} from "@textfresser/vault-action-manager";
import { Deferred, Effect, Exit, Fiber, Scope } from "effect";
import {
	Librarian,
	type LibrarianVam,
} from "../../../src/commanders/librarian/librarian";
import type { PageSplitPlan } from "../../../src/commanders/librarian/pages/build-actions";
import { createLifecycleNotices } from "../../../src/lifecycle/lifecycle-notices";
import { createLifecycleSupervisor } from "../../../src/lifecycle/lifecycle-supervisor";
import { makeObsidianVault } from "../../../src/packages/independent/vault-action-manager/tests/unit/helpers/obsidian-vault";
import { fixedSettings } from "../common-utils/test-settings";

const RAMEN = "Library/Soup/Ramen";

/** What one Librarian, by the order it was made in, was handed and did. */
type Seen = {
	/** The handler it gave VAM, once it subscribed. */
	onBulk?: (bulk: BulkVaultEvent) => Effect.Effect<void>;
	/** Each batch it dispatched, with the supervisor's state at the time. */
	readonly batches: { actions: VaultAction[]; state: string }[];
};

/** The renames of `path` in `batches`. */
const renamesOf = (batches: Seen["batches"], path: string) =>
	batches.flatMap(({ actions, state }) =>
		actions.flatMap((action) =>
			action.kind === VaultActionKind.RenameMdFile &&
			splitPathCodec.format(action.payload.from) === path
				? [{ state, to: splitPathCodec.format(action.payload.to) }]
				: [],
		),
	);

const createdByHand = (path: string): BulkVaultEvent => ({
	events: [
		{
			kind: VaultEventKind.FileCreated,
			origin: { kind: "External" },
			splitPath: splitPathCodec.parse(path),
		},
	],
	roots: [],
}) as unknown as BulkVaultEvent;

/**
 * Librarians over one real VAM, run by the real supervisor. The second
 * Librarian's start waits, once it subscribed, until `releaseStart`.
 */
async function makeHarness() {
	const vault = makeObsidianVault({ [`${RAMEN}/Anchor-Ramen-Soup.md`]: "" });
	const { dispose, manager, testing } = createVaultActionManager(vault.app);
	const seen: Seen[] = [];
	const subscribed = Deferred.makeUnsafe<void>();
	const releaseStart = Deferred.makeUnsafe<void>();
	const notices = createLifecycleNotices(() => {}, { writeStop: () => {} });
	const supervisor = createLifecycleSupervisor<Librarian>({ notices });

	const vamFor = (mine: Seen): LibrarianVam => ({
		cd: (...args) => manager.cd(...args),
		dispatch: (actions, caller) =>
			Effect.suspend(() => {
				mine.batches.push({
					actions: [...actions],
					state: supervisor.librarianState().kind,
				});
				return manager.dispatch(actions, caller);
			}),
		getActiveEditorContext: (...args) =>
			manager.getActiveEditorContext(...args),
		getOpenedContent: (...args) => manager.getOpenedContent(...args),
		mdPwd: (...args) => manager.mdPwd(...args),
		scanAndSubscribe: (folder, handlers, options) =>
			manager.scanAndSubscribe(folder, handlers, options).pipe(
				Effect.tap(() =>
					Effect.gen(function* () {
						mine.onBulk = (bulk) =>
							(handlers.onBulk?.(bulk) ?? Effect.void).pipe(
								Effect.orDie,
							);
						if (seen.indexOf(mine) !== 1) return;
						yield* Deferred.succeed(subscribed, undefined);
						yield* Deferred.await(releaseStart);
					}),
				),
			),
	});

	await Effect.runPromise(manager.startListening());
	await Effect.runPromise(
		supervisor.launch(
			Effect.succeed({
				attachLibrarian: () => () => undefined,
				loadStore: Effect.void,
				makeLibrarian: (onStopped) => {
					const mine: Seen = { batches: [] };
					seen.push(mine);
					return Librarian.make(vamFor(mine), {
						onStopped,
						settings: fixedSettings(),
					});
				},
				onLaunched: () => Effect.void,
				resetRunning: () => false,
				sweep: Effect.void,
			}),
		),
	);
	const settle = () => Effect.runPromise(testing.whenSettled());
	await settle();
	return {
		dispose: async () => {
			await Effect.runPromise(supervisor.stop);
			await Effect.runPromise(dispose);
		},
		releaseStart: () =>
			Effect.runPromise(Deferred.succeed(releaseStart, undefined)),
		seen,
		settle,
		subscribed: () => Effect.runPromise(Deferred.await(subscribed)),
		supervisor,
		vault,
	};
}

describe("a bulk event during a restart", () => {
	it("is handled by the new Librarian once it runs, or not at all", async () => {
		const h = await makeHarness();
		try {
			const old = h.supervisor.librarian();
			expect(h.supervisor.librarianState().kind).toBe("Running");
			const oldOutcomes = old?.getRecentReconciliationOutcomes().length;
			const oldBatches = h.seen[0]?.batches.length;

			const restart = Effect.runFork(h.supervisor.restart);
			await h.subscribed();
			const [first, second] = h.seen;
			const fresh = h.supervisor.librarian();
			expect(fresh).not.toBe(old);
			expect(h.supervisor.librarianState().kind).toBe("Starting");

			// A file made by hand now: VAM holds it for the new
			// subscription, until the new Librarian runs.
			await h.vault.createByHand(`${RAMEN}/Fresh.md`);
			// A bulk handed straight to either handler: the old Librarian
			// is closed, and the new one is half started.
			await Effect.runPromise(
				first?.onBulk?.(createdByHand(`${RAMEN}/Stray.md`)) ?? Effect.void,
			);
			await Effect.runPromise(
				second?.onBulk?.(createdByHand(`${RAMEN}/Early.md`)) ??
					Effect.void,
			);
			expect(fresh?.getRecentReconciliationOutcomes()).toEqual([]);

			await h.releaseStart();
			await Effect.runPromise(Fiber.join(restart));
			await h.settle();

			expect(h.supervisor.librarianState().kind).toBe("Running");
			// The old Librarian handled nothing after its close.
			expect(old?.getRecentReconciliationOutcomes()).toHaveLength(
				oldOutcomes ?? 0,
			);
			expect(first?.batches).toHaveLength(oldBatches ?? 0);
			// The new one healed the file once, while it ran.
			const fromFresh = fresh?.getRecentReconciliationOutcomes() ?? [];
			expect(fromFresh.map((outcome) => outcome.source)).toEqual([
				"Startup",
				"ObservedBulk",
			]);
			expect(renamesOf(second?.batches ?? [], `${RAMEN}/Fresh.md`)).toEqual(
				[{ state: "Running", to: `${RAMEN}/Fresh-Ramen-Soup.md` }],
			);
			expect(h.vault.files()).toContain(`${RAMEN}/Fresh-Ramen-Soup.md`);
			// Neither hand-delivered bulk was healed by anyone.
			for (const batches of [first?.batches, second?.batches]) {
				expect(renamesOf(batches ?? [], `${RAMEN}/Stray.md`)).toEqual([]);
				expect(renamesOf(batches ?? [], `${RAMEN}/Early.md`)).toEqual([]);
			}
		} finally {
			await h.dispose();
		}
	}, 30_000);
});

describe("a Librarian's state", () => {
	/** A Librarian over a VAM whose scan waits until `release`. */
	async function heldLibrarian() {
		const vault = makeObsidianVault({ [`${RAMEN}/Anchor-Ramen-Soup.md`]: "" });
		const { dispose, manager } = createVaultActionManager(vault.app);
		const scanning = Deferred.makeUnsafe<void>();
		const release = Deferred.makeUnsafe<void>();
		const dispatched: VaultAction[][] = [];
		const vam: LibrarianVam = {
			cd: (...args) => manager.cd(...args),
			dispatch: (actions, caller) =>
				Effect.suspend(() => {
					dispatched.push([...actions]);
					return manager.dispatch(actions, caller);
				}),
			getActiveEditorContext: (...args) =>
				manager.getActiveEditorContext(...args),
			getOpenedContent: (...args) => manager.getOpenedContent(...args),
			mdPwd: (...args) => manager.mdPwd(...args),
			scanAndSubscribe: (...args) =>
				Deferred.succeed(scanning, undefined).pipe(
					Effect.andThen(Deferred.await(release)),
					Effect.andThen(manager.scanAndSubscribe(...args)),
				),
		};
		await Effect.runPromise(manager.startListening());
		const scope = Scope.makeUnsafe();
		const stops: unknown[] = [];
		const librarian = Effect.runSync(
			Librarian.make(vam, {
				onStopped: (stop) => void stops.push(stop),
				settings: fixedSettings(),
			}).pipe(
				Scope.provide(scope),
			),
		);
		return {
			close: () => Effect.runPromise(Scope.close(scope, Exit.void)),
			dispatched,
			dispose: () => Effect.runPromise(dispose),
			librarian,
			release: () => Effect.runPromise(Deferred.succeed(release, undefined)),
			scanning: () => Effect.runPromise(Deferred.await(scanning)),
			stops,
		};
	}

	const SPLIT: PageSplitPlan = {
		firstPagePath: splitPathCodec.parse(`${RAMEN}/Story-Ramen-Soup.md`),
		treeActions: [],
		vaultActions: [],
	} as unknown as PageSplitPlan;

	it("answers plainly before its start read the settings", async () => {
		const h = await heldLibrarian();
		const path = splitPathCodec.parse(`${RAMEN}/Anchor-Ramen-Soup.md`);
		const md = path as Parameters<Librarian["getPrevPage"]>[0];
		expect(h.librarian.codecRules).toBeNull();
		expect(h.librarian.isInsideLibrary(path)).toBe(false);
		expect(h.librarian.isCodexInsideLibrary(md)).toBe(false);
		expect(h.librarian.listCommandsExecutableIn(md)).toEqual([]);
		expect(h.librarian.resolveWikilinkAlias("Anchor-Ramen-Soup")).toBeNull();
		expect(h.librarian.parseLibraryBasename("Anchor-Ramen-Soup")).toBeNull();
		expect(h.librarian.getPrevPage(md)).toBeNull();
		expect(h.librarian.getHealer()).toBeNull();
		await h.close();
		await h.dispose();
	});

	it("runs a split that comes while it starts once it runs, under the rules it started with", async () => {
		const h = await heldLibrarian();
		try {
			const init = Effect.runFork(h.librarian.init());
			await h.scanning();
			// It read its settings: their rules are the ones a split plans with.
			expect(h.librarian.codecRules?.libraryRootName).toBe("Library");
			const split = Effect.runFork(h.librarian.executeSplitIntention(SPLIT));
			await new Promise((resolve) => setTimeout(resolve, 0));
			expect(split.pollUnsafe()).toBeUndefined();

			await h.release();
			await Effect.runPromise(Fiber.join(init));
			const result = await Effect.runPromise(Fiber.join(split));
			expect(result.kind).toBe("Completed");
			expect(result.operationId).toBe("split-1");
			expect(
				h.librarian.getRecentReconciliationOutcomes().map((o) => o.source),
			).toEqual(["Startup", "CommandIntention"]);
		} finally {
			await h.close();
			await h.dispose();
		}
	}, 30_000);

	it("refuses a second start, and keeps running and quiet", async () => {
		const h = await heldLibrarian();
		try {
			await h.release();
			await Effect.runPromise(h.librarian.init());
			const again = await Effect.runPromiseExit(h.librarian.init());
			expect(again._tag).toBe("Failure");
			expect(h.stops).toEqual([]);
			const split = await Effect.runPromise(
				h.librarian.executeSplitIntention(SPLIT),
			);
			expect(split.kind).toBe("Completed");
		} finally {
			await h.close();
			await h.dispose();
		}
	}, 30_000);

	it("refuses new work once its scope closed, and its start then never subscribes", async () => {
		const h = await heldLibrarian();
		try {
			await h.close();
			const split = await Effect.runPromiseExit(
				h.librarian.executeSplitIntention(SPLIT),
			);
			expect(split._tag).toBe("Failure");
			const init = await Effect.runPromiseExit(h.librarian.init());
			expect(init._tag).toBe("Failure");
			expect(h.dispatched).toEqual([]);
			expect(h.librarian.getHealer()).toBeNull();
		} finally {
			await h.dispose();
		}
	}, 30_000);

	it("closed while it subscribes, closes the new subscription and never runs", async () => {
		const h = await heldLibrarian();
		try {
			const init = Effect.runFork(h.librarian.init());
			await h.scanning();
			const closing = h.close();
			await h.release();
			const exit = await Effect.runPromise(Fiber.await(init));
			await closing;
			expect(exit._tag).toBe("Failure");
			expect(h.librarian.getHealer()).toBeNull();
			expect(h.dispatched).toEqual([]);
		} finally {
			await h.dispose();
		}
	}, 30_000);
});
