import { describe, expect, it } from "bun:test";
import {
	createVaultActionManager,
	type ProtectedPathModificationsEvent,
	type SplitPathToFolder,
	type SplitPathToMdFile,
	splitPathCodec,
	VamDispatchFailure,
	VamProtectedPathError,
	type VaultAction,
	VaultActionKind,
} from "@textfresser/vault-action-manager";
import { Effect, Exit } from "effect";
import { makeVaultHarness } from "./helpers/vault-harness";

const md = (path: string) => splitPathCodec.parse(path) as SplitPathToMdFile;
const folder = (path: string) =>
	splitPathCodec.parse(path) as SplitPathToFolder;

const EXEMPLAR_NOTE = "Exemplar/Kohlekraftwerk/Kohlekraftwerk.md";

function makeManager(harness: ReturnType<typeof makeVaultHarness>) {
	return createVaultActionManager(harness.app, {
		protectedPaths: ["Exemplar"],
	});
}

const upsert = (path: string): VaultAction => ({
	kind: VaultActionKind.UpsertMdFile,
	payload: { content: "new", splitPath: md(path) },
});

describe("VaultActionManager protected paths: dispatch", () => {
	it("refuses a whole batch that names a protected path, running none of it", async () => {
		const harness = makeVaultHarness();
		harness.addFile("Worter/Hund.md", "# Hund");
		harness.addFile(EXEMPLAR_NOTE, "# Kohlekraftwerk");
		const { dispose, manager, testing } = makeManager(harness);

		const exit = await Effect.runPromiseExit(
			manager.dispatch([
				upsert("Worter/Katze.md"),
				{
					kind: VaultActionKind.ProcessMdFile,
					payload: {
						splitPath: md(EXEMPLAR_NOTE),
						transform: () => "damaged",
					},
				},
			]),
		);
		await Effect.runPromise(testing.whenSettled());

		expect(Exit.isFailure(exit)).toBe(true);
		const failure = Exit.isFailure(exit)
			? exit.cause.reasons
					.map((reason) =>
						reason._tag === "Fail" ? reason.error : undefined,
					)
					.find((value) => value instanceof VamDispatchFailure)
			: undefined;
		const error =
			failure?.reason instanceof VamProtectedPathError
				? failure.reason
				: undefined;
		expect(error).toBeInstanceOf(VamProtectedPathError);
		expect(failure?.report.touchedVault).toBe("no");
		expect(failure?.report.skipped).toHaveLength(2);
		expect(failure?.message).toBe(error?.message);
		expect(error?.path).toBe(EXEMPLAR_NOTE);
		expect(error?.prefix).toBe("Exemplar");
		expect(error?.relation).toBe("inside");
		expect(error?.message).toBe(
			`ProcessMdFile ${EXEMPLAR_NOTE}: refused, the path is protected (under "Exemplar"); no action in the batch ran`,
		);
		expect(harness.writes).toEqual([]);

		await Effect.runPromise(dispose);
	});

	it("refuses through dispatchStopOnFirstFailure with the same typed error", async () => {
		const harness = makeVaultHarness();
		harness.addFile(EXEMPLAR_NOTE, "# Kohlekraftwerk");
		const { dispose, manager } = makeManager(harness);

		const failure = await Effect.runPromise(
			manager
				.dispatchStopOnFirstFailure([
					{
						kind: VaultActionKind.RenameFolder,
						payload: {
							from: folder("Exemplar"),
							to: folder("Archive"),
						},
					},
				])
				.pipe(Effect.flip),
		);

		expect(failure.reason).toBeInstanceOf(VamProtectedPathError);
		expect(failure.report.executed).toEqual([]);
		expect(harness.writes).toEqual([]);
		await Effect.runPromise(dispose);
	});

	it("refuses trashing the vault root, which contains every protected path", async () => {
		const harness = makeVaultHarness();
		const { dispose, manager } = makeManager(harness);

		const failure = await Effect.runPromise(
			manager
				.dispatch([
					{
						kind: VaultActionKind.TrashFolder,
						payload: { splitPath: splitPathCodec.root },
					},
				])
				.pipe(Effect.flip),
		);

		expect(failure.reason).toBeInstanceOf(VamProtectedPathError);
		expect(failure.message).toBe(
			'TrashFolder (vault root): refused, the path contains the protected path "Exemplar"; no action in the batch ran',
		);
		await Effect.runPromise(dispose);
	});

	it("runs batches beside the protected prefix, near-misses included", async () => {
		const harness = makeVaultHarness();
		const { dispose, manager } = makeManager(harness);

		await Effect.runPromise(
			manager.dispatch([
				upsert("Exemplars/Note.md"),
				upsert("Worter/Hund.md"),
			]),
		);

		expect(harness.writes).toEqual([
			"create Exemplars/Note.md",
			"create Worter/Hund.md",
		]);
		await Effect.runPromise(dispose);
	});

	it("exposes the normalized prefixes and rejects a root prefix", () => {
		const harness = makeVaultHarness();
		const { manager } = createVaultActionManager(harness.app, {
			protectedPaths: ["/Exemplar/"],
		});
		expect(manager.protectedPathPrefixes).toEqual(["Exemplar"]);
		expect(manager.protectedPrefixOf("exemplar/Kohlekraftwerk/A.md")).toBe(
			"Exemplar",
		);
		expect(manager.protectedPrefixOf("Exemplars/A.md")).toBeUndefined();
		expect(() =>
			createVaultActionManager(harness.app, { protectedPaths: ["/"] }),
		).toThrow(/vault root/);
	});

	it("compares case as the adapter's file system does", () => {
		const sensitive = createVaultActionManager(
			makeVaultHarness({ insensitive: false }).app,
			{ protectedPaths: ["Exemplar"] },
		).manager;
		expect(sensitive.paths.caseInsensitive).toBe(false);
		expect(sensitive.protectedPrefixOf("Exemplar/A.md")).toBe("Exemplar");
		expect(sensitive.protectedPrefixOf("exemplar/A.md")).toBeUndefined();

		const insensitive = createVaultActionManager(makeVaultHarness().app, {
			protectedPaths: ["Exemplar"],
		}).manager;
		expect(insensitive.paths.caseInsensitive).toBe(true);
		expect(insensitive.protectedPrefixOf("exemplar/A.md")).toBe("Exemplar");

		const overridden = createVaultActionManager(makeVaultHarness().app, {
			fileSystem: { caseInsensitive: false },
			protectedPaths: ["Exemplar"],
		}).manager;
		expect(overridden.protectedPrefixOf("exemplar/A.md")).toBeUndefined();
	});
});

describe("VaultActionManager protected paths: modifications", () => {
	async function observe(
		harness: ReturnType<typeof makeVaultHarness>,
		act: (
			manager: ReturnType<typeof makeManager>["manager"],
		) => Effect.Effect<void, unknown>,
	): Promise<ProtectedPathModificationsEvent[]> {
		const { dispose, manager, testing } = makeManager(harness);
		const received: ProtectedPathModificationsEvent[] = [];
		await Effect.runPromise(
			Effect.gen(function* () {
				yield* manager.startListening();
				// Rename callbacks, which settle VAM's own renames, are only
				// listened to while a Bulk Vault Event subscriber exists.
				yield* manager.subscribeToBulk(() => Effect.void);
				yield* manager.subscribeToProtectedPathModifications((event) =>
					Effect.sync(() => {
						received.push(event);
					}),
				);
				yield* act(manager);
				yield* testing.whenSettled();
			}),
		);
		await Effect.runPromise(dispose);
		return received;
	}

	const origins = (events: readonly ProtectedPathModificationsEvent[]) =>
		events.flatMap(({ modifications }) =>
			modifications.map(({ origin, prefix, splitPath }) => ({
				origin,
				path: splitPathCodec.format(splitPath),
				prefix,
			})),
		);

	it("reports an edit of a closed protected file as Unattributed, and ignores other files", async () => {
		const harness = makeVaultHarness();
		const note = harness.addFile(EXEMPLAR_NOTE, "# Kohlekraftwerk");
		const near = harness.addFile("Exemplars/Note.md", "# Note");

		const received = await observe(harness, () =>
			Effect.sync(() => {
				harness.editByHand(note, "# Kohlekraftwerk\n\nchanged");
				harness.editByHand(near, "# Note\n\nchanged");
			}),
		);

		expect(origins(received)).toEqual([
			{ origin: "Unattributed", path: EXEMPLAR_NOTE, prefix: "Exemplar" },
		]);
	});

	it("reports an edit of a protected file open in an editor as OpenInEditor", async () => {
		const harness = makeVaultHarness();
		const note = harness.addFile(EXEMPLAR_NOTE, "# Kohlekraftwerk");
		harness.open(EXEMPLAR_NOTE);

		const received = await observe(harness, () =>
			Effect.sync(() =>
				harness.editByHand(note, "# Kohlekraftwerk\n\ntyped"),
			),
		);

		expect(origins(received)).toEqual([
			{ origin: "OpenInEditor", path: EXEMPLAR_NOTE, prefix: "Exemplar" },
		]);
	});

	it("attributes link rewriting after a VAM rename, even of an open file", async () => {
		const harness = makeVaultHarness();
		harness.addFile("Worter/Hund.md", "# Hund");
		const note = harness.addFile(EXEMPLAR_NOTE, "[[Hund]]");
		harness.linkingFiles.push(note);
		harness.open(EXEMPLAR_NOTE);

		const received = await observe(harness, (manager) =>
			manager.dispatch([
				{
					kind: VaultActionKind.RenameMdFile,
					payload: {
						from: md("Worter/Hund.md"),
						to: md("Worter/Hunde.md"),
					},
				},
			]),
		);

		expect(origins(received)).toEqual([
			{
				origin: "VamRenameLinkUpdate",
				path: EXEMPLAR_NOTE,
				prefix: "Exemplar",
			},
		]);
	});
});
