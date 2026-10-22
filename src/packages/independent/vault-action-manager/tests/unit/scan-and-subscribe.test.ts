import { afterEach, describe, expect, it } from "bun:test";
import {
	type BulkMdModifyEvent,
	type BulkVaultEvent,
	createVaultActionManager,
	type SplitPathToFolder,
	splitPathCodec,
	VamScanError,
	VamSubscriptionError,
	type VaultEvent,
	type VaultSnapshotSubscription,
} from "@textfresser/vault-action-manager";
import { Effect, Exit } from "effect";
import { makeObsidianVault } from "./helpers/obsidian-vault";

const library: SplitPathToFolder = {
	basename: "Library",
	kind: "Folder",
	pathParts: [],
};

const run = <A, E>(effect: Effect.Effect<A, E>) => Effect.runPromise(effect);

function describeEvent(event: VaultEvent): string {
	return "from" in event
		? `${event.kind} ${splitPathCodec.format(event.from)} -> ${splitPathCodec.format(event.to)}`
		: `${event.kind} ${splitPathCodec.format(event.splitPath)}`;
}

const disposals: (() => Promise<void>)[] = [];

afterEach(async () => {
	for (const dispose of disposals.splice(0)) await dispose();
});

/** Real VAM over an in-memory vault, listening, with a recording handler. */
async function makeHarness(
	initial: Record<string, string>,
	{ listen = true, otherSubscriber = true } = {},
) {
	const vault = makeObsidianVault(initial);
	const { dispose, manager, testing } = createVaultActionManager(vault.app);
	disposals.push(() => run(dispose));
	if (listen) await run(manager.startListening());
	// Another subscriber, as the dictionary store is, keeps VAM listening
	// and its window open before the snapshot.
	if (otherSubscriber) await run(manager.subscribeToBulk(() => Effect.void));
	const bulks: BulkVaultEvent[] = [];
	const modifications: BulkMdModifyEvent[] = [];
	const subscribe = () =>
		run(
			manager.scanAndSubscribe(library, {
				onBulk: (bulk) => Effect.sync(() => void bulks.push(bulk)),
				onModifications: (event) =>
					Effect.sync(() => void modifications.push(event)),
			}),
		);
	return {
		bulks,
		/** Every delivered event, in order. */
		delivered: () =>
			bulks.flatMap((bulk) => bulk.events.map(describeEvent)),
		manager,
		modifications,
		settle: () => run(testing.whenSettled()),
		subscribe,
		vault,
	};
}

const paths = (subscription: VaultSnapshotSubscription) =>
	subscription.snapshot.entries.map((entry) => splitPathCodec.format(entry));

describe("VaultActionManager scanAndSubscribe", () => {
	it("fails before startListening, since it would miss changes", async () => {
		const harness = await makeHarness(
			{ "Library/a.md": "" },
			{ listen: false, otherSubscriber: false },
		);

		const exit = await Effect.runPromiseExit(
			harness.manager.scanAndSubscribe(library, {
				onBulk: () => Effect.void,
			}),
		);

		expect(Exit.isFailure(exit)).toBe(true);
		if (Exit.isFailure(exit)) {
			expect(String(exit.cause)).toContain("startListening");
			expect(
				exit.cause.reasons.some(
					(reason) =>
						reason._tag === "Fail" &&
						reason.error instanceof VamSubscriptionError,
				),
			).toBe(true);
		}
	});

	it("fails with a scanRoot error for a folder that is not there", async () => {
		const harness = await makeHarness({ "Other/a.md": "" });

		const exit = await Effect.runPromiseExit(
			harness.manager.scanAndSubscribe(library, {
				onBulk: () => Effect.void,
			}),
		);

		expect(Exit.isFailure(exit)).toBe(true);
		if (Exit.isFailure(exit)) {
			const [reason] = exit.cause.reasons;
			expect(reason?._tag).toBe("Fail");
			if (reason?._tag === "Fail") {
				expect(reason.error).toBeInstanceOf(VamScanError);
				expect((reason.error as VamScanError).operation).toBe(
					"scanRoot",
				);
			}
		}
	});

	it("lists the folder's files with their stats and readable content", async () => {
		const harness = await makeHarness({
			"Library/a.md": "ay",
			"Library/pic.png": "x",
			"Library/Sub/b.md": "bee",
			"Outside/c.md": "",
		});

		const subscription = await harness.subscribe();

		expect(subscription.snapshot.kind).toBe("Complete");
		expect(subscription.snapshot.counts).toEqual({
			folderCount: 2,
			markdownFileCount: 2,
			otherFileCount: 1,
		});
		expect(paths(subscription)).toEqual([
			"Library/Sub/b.md",
			"Library/a.md",
			"Library/pic.png",
		]);
		const [b] = subscription.snapshot.entries;
		expect(b?.stat).toEqual({ ctime: 1, mtime: 1, size: 3 });
		if (b?.kind === "MdFile") expect(await run(b.read())).toBe("bee");
	});

	it("delivers nothing before start, then every change after the snapshot exactly once", async () => {
		const harness = await makeHarness({ "Library/a.md": "" });
		const subscription = await harness.subscribe();

		// While the consumer builds its state from the snapshot.
		await harness.vault.createByHand("Library/during.md");
		const settledBeforeStart = await Promise.race([
			harness.settle().then(() => "settled"),
			new Promise((resolve) => setTimeout(() => resolve("waiting"), 600)),
		]);
		expect(settledBeforeStart).toBe("waiting");
		expect(harness.bulks).toEqual([]);

		await run(subscription.start);
		await harness.settle();
		await harness.vault.createByHand("Library/after.md");
		await harness.settle();

		expect(harness.delivered()).toEqual([
			"FileCreated Library/during.md",
			"FileCreated Library/after.md",
		]);
		expect(paths(subscription)).toEqual(["Library/a.md"]);
	}, 10_000);

	it("never delivers a change from before the snapshot, though it shares the open window", async () => {
		const harness = await makeHarness({ "Library/a.md": "" });
		await harness.vault.createByHand("Library/before.md");

		const subscription = await harness.subscribe();
		await harness.vault.createByHand("Library/after.md");
		await run(subscription.start);
		await harness.settle();

		expect(paths(subscription)).toContain("Library/before.md");
		expect(harness.delivered()).toEqual(["FileCreated Library/after.md"]);
	});

	it("delivers a rename that straddles the cursor as its part after it", async () => {
		const harness = await makeHarness({ "Library/a.md": "" });
		await harness.vault.createByHand("Library/fresh.md");
		await harness.vault.renameByHand("Library/a.md", "Library/b.md");

		const subscription = await harness.subscribe();
		await harness.vault.renameByHand(
			"Library/fresh.md",
			"Library/moved.md",
		);
		await harness.vault.renameByHand("Library/b.md", "Library/c.md");
		await run(subscription.start);
		await harness.settle();

		expect(paths(subscription)).toEqual([
			"Library/b.md",
			"Library/fresh.md",
		]);
		// Collapsed over the whole window, these would be a create of
		// moved.md and a rename from a.md, which the snapshot never held.
		expect(harness.delivered().sort()).toEqual([
			"FileRenamed Library/b.md -> Library/c.md",
			"FileRenamed Library/fresh.md -> Library/moved.md",
		]);
	});

	it("keeps a folder rename on one side of the snapshot", async () => {
		const harness = await makeHarness({
			"Library/Early/one.md": "1",
			"Library/Late/two.md": "2",
		});
		await harness.vault.renameByHand("Library/Early", "Library/Earlier");

		const subscription = await harness.subscribe();
		// The consumer reads the snapshot while the user renames a folder.
		await harness.vault.renameByHand("Library/Late", "Library/Later");
		const two = subscription.snapshot.entries.find(
			(entry) => entry.basename === "two",
		);
		const read =
			two?.kind === "MdFile"
				? await Effect.runPromiseExit(two.read())
				: undefined;
		await run(subscription.start);
		await harness.settle();

		expect(paths(subscription)).toEqual([
			"Library/Earlier/one.md",
			"Library/Late/two.md",
		]);
		// The moved file's read fails, and the rename after the cursor says
		// where it went.
		expect(read && Exit.isFailure(read)).toBe(true);
		expect(
			harness.bulks.flatMap((bulk) => bulk.roots.map(describeEvent)),
		).toEqual(["FolderRenamed Library/Late -> Library/Later"]);
		expect(harness.delivered()).not.toContain(
			"FolderRenamed Library/Early -> Library/Earlier",
		);
	});

	it("drops changes a rescan holds, and answers whether a delivered bulk is still news", async () => {
		const harness = await makeHarness({ "Library/a.md": "" });
		const subscription = await harness.subscribe();
		await harness.vault.createByHand("Library/held.md");

		const rescanned = await run(subscription.rescan);
		await run(subscription.start);
		await harness.settle();

		expect(rescanned.cursor).toBeGreaterThan(subscription.snapshot.cursor);
		expect(
			rescanned.entries.map((e) => splitPathCodec.format(e)),
		).toContain("Library/held.md");
		expect(harness.bulks).toEqual([]);

		await harness.vault.createByHand("Library/news.md");
		await harness.settle();
		const [bulk] = harness.bulks;
		if (!bulk) throw new Error("expected one bulk");
		expect(subscription.afterSnapshot(bulk)).toBe(bulk);
		// A rescan after it was delivered holds all of it.
		await run(subscription.rescan);
		expect(subscription.afterSnapshot(bulk)).toBeNull();
	});

	it("gives a fresh cursor on re-subscribing, and nothing from before it", async () => {
		const harness = await makeHarness(
			{ "Library/a.md": "" },
			{ otherSubscriber: false },
		);
		const first = await harness.subscribe();
		await run(first.start);
		await harness.vault.createByHand("Library/first.md");
		await harness.settle();
		await run(first.close);

		// Nobody listens now, so VAM hears nothing of this.
		await harness.vault.createByHand("Library/unheard.md");
		harness.bulks.length = 0;

		const second = await harness.subscribe();
		await run(second.start);
		await harness.vault.createByHand("Library/second.md");
		await harness.settle();

		expect(second.snapshot.cursor).toBeGreaterThan(first.snapshot.cursor);
		expect(paths(second)).toContain("Library/unheard.md");
		expect(harness.delivered()).toEqual(["FileCreated Library/second.md"]);
	});

	it("delivers Markdown modifications below the folder after the snapshot only", async () => {
		const harness = await makeHarness({
			"Library/a.md": "one",
			"Outside/b.md": "one",
		});
		const other = await run(
			harness.manager.subscribeToMdModifications(
				splitPathCodec.root,
				() => Effect.void,
			),
		);
		harness.vault.editByHand("Library/a.md", "two");

		const subscription = await harness.subscribe();
		harness.vault.editByHand("Library/a.md", "three");
		harness.vault.editByHand("Outside/b.md", "two");
		await run(subscription.start);
		await harness.settle();

		expect(
			harness.modifications.flatMap((event) =>
				event.modifications.map(({ splitPath, stat }) => [
					splitPathCodec.format(splitPath),
					stat.size,
				]),
			),
		).toEqual([["Library/a.md", 5]]);
		await run(other.close);
	});
});
