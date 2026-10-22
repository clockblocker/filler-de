/**
 * Every delivered event carries its origin, and each subscription takes the
 * origins its `from` names: VAM's own writes are no longer hidden from every
 * subscriber, only from those that leave them out.
 */
import { describe, expect, it } from "bun:test";
import {
	type BulkMdModifyEvent,
	type BulkVaultEvent,
	createVaultActionManager,
	type SplitPathToFolder,
	type SplitPathToMdFile,
	splitPathCodec,
	type VamSubscribeOptions,
	type VaultAction,
	VaultActionKind,
	type VaultActionManager,
} from "@textfresser/vault-action-manager";
import { Effect } from "effect";
import { makeObsidianVault } from "./helpers/obsidian-vault";

const md = (path: string) => splitPathCodec.parse(path) as SplitPathToMdFile;
const folder = (path: string) =>
	splitPathCodec.parse(path) as SplitPathToFolder;

const create = (path: string, content: string): VaultAction => ({
	kind: VaultActionKind.CreateMdFile,
	payload: { content, splitPath: md(path) },
});

const append = (path: string, suffix: string): VaultAction => ({
	kind: VaultActionKind.ProcessMdFile,
	payload: {
		splitPath: md(path),
		transform: (content) => `${content}\n${suffix}`,
	},
});

const renameMd = (from: string, to: string): VaultAction => ({
	kind: VaultActionKind.RenameMdFile,
	payload: { from: md(from), onCollision: "fail", to: md(to) },
});

/** What a subscription received, flattened: one line per event. */
type Received = {
	bulk: string[];
	modified: string[];
};

const describeOrigin = (
	origin: BulkVaultEvent["events"][number]["origin"],
): string => {
	switch (origin.kind) {
		case "Vam":
			return `Vam ${origin.caller} ${origin.operationId}`;
		case "LinkUpdate":
			return `LinkUpdate ${origin.operationId}`;
		case "External":
			return "External";
	}
};

const describeBulk = (event: BulkVaultEvent): string[] =>
	event.events.map((each) => {
		const where =
			"splitPath" in each
				? splitPathCodec.format(each.splitPath)
				: `${splitPathCodec.format(each.from)} -> ${splitPathCodec.format(each.to)}`;
		return `${each.kind} ${where} (${describeOrigin(each.origin)})`;
	});

const describeModify = (event: BulkMdModifyEvent): string[] =>
	event.modifications.map(
		({ origin, splitPath }) =>
			`${splitPathCodec.format(splitPath)} (${describeOrigin(origin)})`,
	);

/** Subscribes to both channels, below the root, with `options`. */
const subscribeBoth = Effect.fn("test.subscribeBoth")(function* (
	manager: VaultActionManager,
	options: VamSubscribeOptions,
) {
	const received: Received = { bulk: [], modified: [] };
	const bulk = yield* manager.subscribeToBulk(
		(event) =>
			Effect.sync(() => received.bulk.push(...describeBulk(event))),
		options,
	);
	yield* manager.subscribeToMdModifications(
		splitPathCodec.root,
		(event) =>
			Effect.sync(() => received.modified.push(...describeModify(event))),
		options,
	);
	return { bulk, received };
});

function setUp(initial: Record<string, string>) {
	const vault = makeObsidianVault(initial);
	const vam = createVaultActionManager(vault.app);
	const run = <A, E>(effect: Effect.Effect<A, E>) =>
		Effect.runPromise(
			effect.pipe(Effect.ensuring(Effect.ignore(vam.dispose))),
		);
	return { ...vam, run, vault };
}

describe("origins of delivered events", () => {
	it("delivers each origin to the subscriptions whose `from` takes it", async () => {
		const { manager, run, testing, vault } = setUp({
			"Library/Note.md": "# Note",
			"Worter/Hund.md": "# Hund",
		});

		const [external, allButMine, all, unnamed] = await run(
			Effect.gen(function* () {
				yield* manager.startListening();
				const subscribed = [
					yield* subscribeBoth(manager, { from: "external" }),
					yield* subscribeBoth(manager, {
						caller: "dictionary",
						from: "allButMine",
					}),
					yield* subscribeBoth(manager, { from: "all" }),
					yield* subscribeBoth(manager, {}),
				];
				yield* manager.dispatch(
					[create("Worter/Katze.md", "# Katze")],
					{
						caller: "dictionary",
						operationId: "dictionary-commit",
					},
				);
				yield* manager.dispatch(
					[append("Worter/Hund.md", "migrated")],
					{
						caller: "migration",
						operationId: "migration-run",
					},
				);
				yield* Effect.promise(() =>
					vault.createByHand("Library/Hand.md", "# Hand"),
				);
				vault.editByHand("Library/Note.md", "# Note\n\nedited");
				yield* testing.whenSettled();
				return subscribed.map(({ received }) => received);
			}),
		);

		expect(external).toEqual({
			bulk: ["FileCreated Library/Hand.md (External)"],
			modified: ["Library/Note.md (External)"],
		});
		// The default is `external`, as before origins existed.
		expect(unnamed).toEqual(external);
		expect(allButMine).toEqual({
			bulk: ["FileCreated Library/Hand.md (External)"],
			modified: [
				"Worter/Hund.md (Vam migration migration-run)",
				"Library/Note.md (External)",
			],
		});
		expect(all).toEqual({
			bulk: [
				"FileCreated Worter/Katze.md (Vam dictionary dictionary-commit)",
				"FileCreated Library/Hand.md (External)",
			],
			modified: [
				"Worter/Hund.md (Vam migration migration-run)",
				"Library/Note.md (External)",
			],
		});
	});

	it("names a batch by its operationId in the report and in its events' origins", async () => {
		const { manager, run, testing } = setUp({ "Library/Old.md": "# Old" });

		const { generated, given, received } = await run(
			Effect.gen(function* () {
				yield* manager.startListening();
				const { received } = yield* subscribeBoth(manager, {
					from: "all",
				});
				const generated = yield* manager.dispatchWithReport(
					[renameMd("Library/Old.md", "Library/New.md")],
					{ caller: "librarian" },
				);
				const given = yield* manager.dispatchWithReport(
					[renameMd("Library/New.md", "Library/Newer.md")],
					{ caller: "librarian", operationId: "heal-42" },
				);
				// One window, so the chain arrives collapsed, labelled as its
				// last hop.
				yield* testing.whenSettled();
				return { generated, given, received };
			}),
		);

		expect(generated.caller).toBe("librarian");
		expect(generated.operationId).toMatch(/^librarian#\d+$/);
		expect(given.operationId).toBe("heal-42");
		expect(received.bulk).toEqual([
			"FileRenamed Library/Old.md -> Library/Newer.md (Vam librarian heal-42)",
		]);
	});

	it("labels a folder rename's descendant renames with the folder rename's operation", async () => {
		const { manager, run, testing } = setUp({
			"Worter/de/a.md": "# a",
			"Worter/de/sub/b.md": "# b",
		});

		const received = await run(
			Effect.gen(function* () {
				yield* manager.startListening();
				const events: BulkVaultEvent[] = [];
				yield* manager.subscribeToBulk(
					(event) => Effect.sync(() => events.push(event)),
					{ from: "all" },
				);
				const unseen = yield* subscribeBoth(manager, {
					caller: "reset",
					from: "allButMine",
				});
				yield* manager.dispatch(
					[
						{
							kind: VaultActionKind.RenameFolder,
							payload: {
								from: folder("Worter"),
								onCollision: "fail",
								to: folder("Worter backup"),
								updateLinks: false,
							},
						},
					],
					{ caller: "reset", operationId: "reset-backup" },
				);
				yield* testing.whenSettled();
				return { events, unseen: unseen.received };
			}),
		);

		const origins = new Set(
			received.events.flatMap(({ events }) =>
				events.map(({ origin }) => JSON.stringify(origin)),
			),
		);
		expect([...origins]).toEqual([
			JSON.stringify({
				caller: "reset",
				kind: "Vam",
				operationId: "reset-backup",
			}),
		]);
		expect(
			received.events.flatMap(({ roots }) =>
				roots.map((root) => root.origin.kind),
			),
		).toEqual(["Vam"]);
		expect(received.unseen).toEqual({ bulk: [], modified: [] });
	});

	it("collapses a rename chain across origins only for a subscription that takes both", async () => {
		const { manager, run, testing, vault } = setUp({
			"Library/a.md": "# a",
		});

		const [external, all] = await run(
			Effect.gen(function* () {
				yield* manager.startListening();
				const subscribed = [
					yield* subscribeBoth(manager, { from: "external" }),
					yield* subscribeBoth(manager, { from: "all" }),
				];
				yield* Effect.promise(() =>
					vault.renameByHand("Library/a.md", "Library/b.md"),
				);
				yield* manager.dispatch(
					[renameMd("Library/b.md", "Library/c.md")],
					{ caller: "librarian", operationId: "heal-b" },
				);
				yield* testing.whenSettled();
				return subscribed.map(({ received }) => received.bulk);
			}),
		);

		expect(external).toEqual([
			"FileRenamed Library/a.md -> Library/b.md (External)",
		]);
		expect(all).toEqual([
			"FileRenamed Library/a.md -> Library/c.md (Vam librarian heal-b)",
		]);
	});

	it("waits in `caughtUp` until the handler has run for what VAM heard before it", async () => {
		const { manager, run } = setUp({ "Worter/Hund.md": "# Hund" });

		const { afterCaughtUp, beforeCaughtUp } = await run(
			Effect.gen(function* () {
				yield* manager.startListening();
				const { bulk, received } = yield* subscribeBoth(manager, {
					caller: "dictionary",
					from: "allButMine",
				});
				yield* manager.dispatch(
					[create("Worter/Katze.md", "# Katze")],
					{
						caller: "reset",
						operationId: "reset-note",
					},
				);
				// The window is still open: nothing is delivered yet.
				const beforeCaughtUp = [...received.bulk];
				yield* bulk.caughtUp;
				return { afterCaughtUp: [...received.bulk], beforeCaughtUp };
			}),
		);

		expect(beforeCaughtUp).toEqual([]);
		expect(afterCaughtUp).toEqual([
			"FileCreated Worter/Katze.md (Vam reset reset-note)",
		]);
	});

	it("names the operation in the report of a batch that never ran", async () => {
		const vault = makeObsidianVault({ "Exemplar/Note.md": "# Note" });
		const { dispose, manager } = createVaultActionManager(vault.app, {
			protectedPaths: ["Exemplar"],
		});

		const failure = await Effect.runPromise(
			manager
				.dispatchWithReport([append("Exemplar/Note.md", "no")], {
					caller: "classify",
					operationId: "classify-7",
				})
				.pipe(Effect.flip, Effect.ensuring(Effect.ignore(dispose))),
		);

		expect(failure.reason._tag).toBe("VamProtectedPathError");
		expect(failure.report.caller).toBe("classify");
		expect(failure.report.operationId).toBe("classify-7");
		expect(failure.report.skipped).toHaveLength(1);
	});
});
