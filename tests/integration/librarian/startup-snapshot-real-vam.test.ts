/**
 * The Librarian's startup over the real Vault Action Manager. Its snapshot
 * and its subscription share one cursor: a change from before the
 * snapshot never reaches it as an event, and a change after it reaches it
 * exactly once, even when it lands while startup reconciliation runs or a
 * startup recovery rescans.
 */
import { afterEach, beforeEach, describe, expect, it, type spyOn } from "bun:test";
import {
	type BulkVaultEvent,
	createVaultActionManager,
	splitPathCodec,
	type VaultAction,
	VaultActionKind,
	VaultEventKind,
} from "@textfresser/vault-action-manager";
import { Effect } from "effect";
import {
	Librarian,
	type LibrarianStop,
	type LibrarianVam,
} from "../../../src/commanders/librarian/librarian";
import { makeObsidianVault } from "../../../src/packages/independent/vault-action-manager/tests/unit/helpers/obsidian-vault";
import { actionError, failedActions } from "../../support/vam-dispatch";
import { setupGetParsedUserSettingsSpy } from "../../unit/common-utils/setup-spy";

let settingsSpy: ReturnType<typeof spyOn>;

beforeEach(() => {
	settingsSpy = setupGetParsedUserSettingsSpy();
});

afterEach(() => {
	settingsSpy.mockRestore();
});

const RAMEN = "Library/Soup/Ramen";

/** The Librarian over real VAM; `beforeDispatch` may act on each batch first. */
function makeHarness(
	initial: Record<string, string>,
	beforeDispatch: (
		actions: readonly VaultAction[],
		dispatchNumber: number,
	) => Promise<"fail" | "run"> = async () => "run",
) {
	const vault = makeObsidianVault(initial);
	const { dispose, manager, testing } = createVaultActionManager(vault.app);
	const bulks: BulkVaultEvent[] = [];
	const batches: VaultAction[][] = [];
	const stops: LibrarianStop[] = [];
	const vam: LibrarianVam = {
		cd: (...args) => manager.cd(...args),
		dispatch: (actions) =>
			Effect.promise(() => beforeDispatch(actions, batches.length + 1)).pipe(
				Effect.flatMap((verdict) => {
					batches.push([...actions]);
					const [first] = actions;
					return verdict === "fail" && first
						? Effect.fail(
								failedActions([
									actionError(first, new Error("destination is locked")),
								]),
							)
						: manager.dispatch(actions);
				}),
			),
		getActiveEditorContext: (...args) =>
			manager.getActiveEditorContext(...args),
		getOpenedContent: (...args) => manager.getOpenedContent(...args),
		mdPwd: (...args) => manager.mdPwd(...args),
		scanAndSubscribe: (folder, { onBulk }) =>
			manager.scanAndSubscribe(folder, {
				onBulk: (bulk) => {
					bulks.push(bulk);
					return onBulk ? onBulk(bulk) : Effect.void;
				},
			}),
	};
	const librarian = new Librarian(vam, {
		onStopped: (stop) => void stops.push(stop),
	});
	return {
		batches,
		bulks,
		librarian,
		manager,
		settle: () => Effect.runPromise(testing.whenSettled()),
		stop: async () => {
			await Effect.runPromise(librarian.unsubscribe());
			await Effect.runPromise(dispose);
		},
		stops,
		vault,
	};
}

/** The renames of `path` the Librarian dispatched. */
function renamesOf(batches: readonly VaultAction[][], path: string) {
	return batches.flat().flatMap((action) =>
		action.kind === VaultActionKind.RenameMdFile &&
		splitPathCodec.format(action.payload.from) === path
			? [splitPathCodec.format(action.payload.to)]
			: [],
	);
}

/** Creates of `path` the Librarian received. */
function createsOf(bulks: readonly BulkVaultEvent[], path: string): number {
	return bulks
		.flatMap((bulk) => bulk.events)
		.filter(
			(event) =>
				event.kind === VaultEventKind.FileCreated &&
				splitPathCodec.format(event.splitPath) === path,
		).length;
}

describe("Librarian startup over real VAM", () => {
	it("heals a file created just before startup from its snapshot alone", async () => {
		const harness = makeHarness({ [`${RAMEN}/Anchor-Ramen-Soup.md`]: "" });
		try {
			await Effect.runPromise(harness.manager.startListening());
			// Another subscriber, as the dictionary store is, keeps VAM
			// listening; the create waits in VAM's open window.
			const other = await Effect.runPromise(
				harness.manager.subscribeToBulk(() => Effect.void),
			);
			await harness.vault.createByHand(`${RAMEN}/Fresh.md`);

			await Effect.runPromise(harness.librarian.init());
			await harness.settle();

			expect(createsOf(harness.bulks, `${RAMEN}/Fresh.md`)).toBe(0);
			expect(renamesOf(harness.batches, `${RAMEN}/Fresh.md`)).toEqual([
				`${RAMEN}/Fresh-Ramen-Soup.md`,
			]);
			expect(harness.vault.files()).toContain(`${RAMEN}/Fresh-Ramen-Soup.md`);
			expect(harness.stops).toEqual([]);
			await Effect.runPromise(other.close);
		} finally {
			await harness.stop();
		}
	}, 30_000);

	it("hears once, after startup, a file created while startup reconciliation runs", async () => {
		const harness = makeHarness(
			{ [`${RAMEN}/Anchor.md`]: "" },
			async (_actions, dispatchNumber) => {
				if (dispatchNumber === 1)
					await harness.vault.createByHand(`${RAMEN}/Late.md`);
				return "run";
			},
		);
		try {
			await Effect.runPromise(harness.manager.startListening());
			await Effect.runPromise(harness.librarian.init());
			await harness.settle();

			expect(createsOf(harness.bulks, `${RAMEN}/Late.md`)).toBe(1);
			expect(renamesOf(harness.batches, `${RAMEN}/Anchor.md`)).toEqual([
				`${RAMEN}/Anchor-Ramen-Soup.md`,
			]);
			expect(renamesOf(harness.batches, `${RAMEN}/Late.md`)).toEqual([
				`${RAMEN}/Late-Ramen-Soup.md`,
			]);
			expect(harness.stops).toEqual([]);
		} finally {
			await harness.stop();
		}
	}, 30_000);

	it("drops a change its startup recovery's rescan already holds", async () => {
		const harness = makeHarness(
			{ [`${RAMEN}/Anchor.md`]: "" },
			async (_actions, dispatchNumber) => {
				if (dispatchNumber !== 1) return "run";
				await harness.vault.createByHand(`${RAMEN}/Late.md`);
				return "fail";
			},
		);
		try {
			await Effect.runPromise(harness.manager.startListening());
			await Effect.runPromise(harness.librarian.init());
			await harness.settle();

			// The rescan saw Late and healed it with Anchor; its create,
			// from before the rescan, never reaches the Librarian.
			expect(
				harness.librarian.getRecentReconciliationOutcomes().at(-1)
					?.recovery,
			).toEqual({ kind: "Resynchronized" });
			expect(createsOf(harness.bulks, `${RAMEN}/Late.md`)).toBe(0);
			expect(renamesOf(harness.batches.slice(1), `${RAMEN}/Late.md`)).toEqual([
				`${RAMEN}/Late-Ramen-Soup.md`,
			]);
			expect(harness.batches).toHaveLength(2);
			expect(harness.vault.files()).toContain(`${RAMEN}/Late-Ramen-Soup.md`);
			expect(harness.stops).toEqual([]);
		} finally {
			await harness.stop();
		}
	}, 30_000);

	it("takes a fresh snapshot on restart, and hears nothing from before it", async () => {
		const harness = makeHarness({ [`${RAMEN}/Anchor-Ramen-Soup.md`]: "" });
		try {
			await Effect.runPromise(harness.manager.startListening());
			await Effect.runPromise(harness.librarian.init());
			await harness.settle();
			await Effect.runPromise(harness.librarian.unsubscribe());

			// While it is off nothing listens, so VAM hears nothing.
			await harness.vault.createByHand(`${RAMEN}/Offline.md`);
			harness.batches.length = 0;
			harness.bulks.length = 0;

			await Effect.runPromise(harness.librarian.init());
			await harness.settle();
			await harness.vault.createByHand(`${RAMEN}/Online.md`);
			await harness.settle();

			expect(createsOf(harness.bulks, `${RAMEN}/Offline.md`)).toBe(0);
			expect(renamesOf(harness.batches, `${RAMEN}/Offline.md`)).toEqual([
				`${RAMEN}/Offline-Ramen-Soup.md`,
			]);
			expect(createsOf(harness.bulks, `${RAMEN}/Online.md`)).toBe(1);
			expect(renamesOf(harness.batches, `${RAMEN}/Online.md`)).toEqual([
				`${RAMEN}/Online-Ramen-Soup.md`,
			]);
		} finally {
			await harness.stop();
		}
	}, 30_000);
});
