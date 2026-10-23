import { describe, expect, it } from "bun:test";
import {
	createVaultActionManager,
	isContentConflict,
	type SplitPathToFolder,
	type SplitPathToMdFile,
	splitPathCodec,
	VamContentConflictError,
	VamDispatchError,
	VamDispatchFailure,
	VamPlanningError,
	VamProtectedPathError,
	VamSetupError,
	VamShutdownError,
	type VaultAction,
	VaultActionKind,
	vaultContentHash,
} from "@textfresser/vault-action-manager";
import { Cause, Effect } from "effect";
import { notRunCause } from "../../src/effect/dispatch-report";
import { makeVaultHarness } from "./helpers/vault-harness";

const md = (path: string) => splitPathCodec.parse(path) as SplitPathToMdFile;
const folder = (path: string) =>
	splitPathCodec.parse(path) as SplitPathToFolder;

const upsert = (path: string, content: string | null): VaultAction => ({
	kind: VaultActionKind.UpsertMdFile,
	payload: { content, splitPath: md(path) },
});

const process = (
	path: string,
	transform: (content: string) => string | Promise<string>,
): VaultAction => ({
	kind: VaultActionKind.ProcessMdFile,
	payload: { splitPath: md(path), transform },
});

const rename = (from: string, to: string): VaultAction => ({
	kind: VaultActionKind.RenameMdFile,
	payload: { from: md(from), to: md(to) },
});

function setup() {
	const harness = makeVaultHarness();
	const { dispose, manager } = createVaultActionManager(harness.app, {
		protectedPaths: ["Exemplar"],
	});
	const fail = (
		actions: readonly VaultAction[],
		stopOnFirstFailure = false,
	) =>
		Effect.runPromise(
			manager
				.dispatchWithReport(actions, {
					caller: "test",
					stopOnFirstFailure,
				})
				.pipe(Effect.flip),
		);
	return { dispose, fail, harness, manager };
}

describe("VaultActionManager dispatch reports", () => {
	it("records what each completed action did", async () => {
		const { dispose, harness, manager } = setup();
		harness.addFile("Library/Kept.md", "kept");
		harness.addFile("Library/Edited.md", "before");
		harness.addFile("Library/Moved.md", "moved");
		harness.addFile("Library/Taken.md", "other");
		harness.addFile("Library/Bumped.md", "bumped");
		harness.addFile("Library/Copy.md", "same");
		harness.addFile("Library/Original.md", "same");
		harness.addFile("Library/Old.md", "old");

		const report = await Effect.runPromise(
			manager.dispatchWithReport(
				[
					upsert("Library/New.md", "fresh"),
					upsert("Library/Kept.md", null),
					upsert("Library/Edited.md", "after"),
					process("Library/Kept.md", (content) => content),
					rename("Library/Moved.md", "Library/Elsewhere.md"),
					rename("Library/Bumped.md", "Library/Taken.md"),
					rename("Library/Copy.md", "Library/Original.md"),
					{
						kind: VaultActionKind.TrashMdFile,
						payload: { splitPath: md("Library/Old.md") },
					},
				],
				{ caller: "test" },
			),
		);

		const outcomes = new Map(
			report.entries.map((entry) => [
				`${entry.action.kind} ${splitPathCodec.format(
					"splitPath" in entry.action.payload
						? entry.action.payload.splitPath
						: entry.action.payload.from,
				)}`,
				entry.status === "Done" ? entry.outcome : entry.status,
			]),
		);
		expect(outcomes.get("UpsertMdFile Library/New.md")).toEqual({
			_tag: "Created",
			contentHash: vaultContentHash("fresh"),
		});
		expect(outcomes.get("UpsertMdFile Library/Edited.md")).toEqual({
			_tag: "Wrote",
			afterHash: vaultContentHash("after"),
			beforeHash: vaultContentHash("before"),
		});
		expect(outcomes.get("RenameMdFile Library/Moved.md")).toEqual({
			_tag: "Renamed",
			to: md("Library/Elsewhere.md"),
		});
		expect(outcomes.get("RenameMdFile Library/Bumped.md")).toEqual({
			_tag: "RenamedToIndexed",
			to: md("Library/1_Taken.md"),
		});
		expect(outcomes.get("RenameMdFile Library/Copy.md")).toEqual({
			_tag: "TrashedDuplicate",
		});
		expect(outcomes.get("TrashMdFile Library/Old.md")).toEqual({
			_tag: "Trashed",
		});
		expect(report.failed).toEqual([]);
		expect(report.touchedVault).toBe("yes");
		await Effect.runPromise(dispose);
	});

	it("reports a batch of no-ops as not touching the vault", async () => {
		const { dispose, harness, manager } = setup();
		harness.addFile("Library/Kept.md", "kept");

		const report = await Effect.runPromise(
			manager.dispatchWithReport(
				[
					upsert("Library/Kept.md", null),
					process("Library/Kept.md", (content) => content),
				],
				{ caller: "test" },
			),
		);

		expect(
			report.entries.map((entry) =>
				entry.status === "Done" ? entry.outcome._tag : entry.status,
			),
		).toEqual(["NoOp", "NoOp"]);
		expect(report.touchedVault).toBe("no");
		await Effect.runPromise(dispose);
	});

	it("reports a planning failure with every submitted action skipped", async () => {
		const { dispose, fail, harness } = setup();
		const actions = [
			upsert("Library/Note.md", "before"),
			process("Library/Note.md", () => {
				throw new Error("planning failed");
			}),
		];

		const failure = await fail(actions);

		expect(failure).toBeInstanceOf(VamDispatchFailure);
		expect(failure.reason).toBeInstanceOf(VamPlanningError);
		expect(failure.report.skipped).toEqual(actions);
		expect(failure.report.executed).toEqual([]);
		expect(failure.report.touchedVault).toBe("no");
		expect(failure.message).toContain("planning failed");
		expect(harness.writes).toEqual([]);
		await Effect.runPromise(dispose);
	});

	it("reports a protected refusal with every submitted action skipped", async () => {
		const { dispose, fail, harness } = setup();
		const actions = [
			upsert("Library/Note.md", "new"),
			upsert("Exemplar/Note.md", "new"),
		];

		const failure = await fail(actions, true);

		expect(failure.reason).toBeInstanceOf(VamProtectedPathError);
		expect(failure.report.skipped).toEqual(actions);
		expect(failure.report.touchedVault).toBe("no");
		expect(harness.writes).toEqual([]);
		await Effect.runPromise(dispose);
	});

	it("attempts every action by default, reporting the ones that failed", async () => {
		const { dispose, fail, harness } = setup();
		harness.addFile("Library/Locked.md", "locked");
		harness.failingWrites.add("Library/Locked.md");

		const failure = await fail([
			upsert("Library/Locked.md", "changed"),
			upsert("Library/Missing.md", "created"),
		]);

		expect(failure.reason).toBeInstanceOf(VamDispatchError);
		const [failed] = failure.report.failed;
		expect(failed?.kind).toBe("io");
		expect(failure.report.uncertain).toEqual([
			upsert("Library/Locked.md", "changed"),
		]);
		expect(failure.report.executed).toEqual([
			upsert("Library/Missing.md", "created"),
		]);
		expect(failure.report.skipped).toEqual([]);
		expect(failure.report.touchedVault).toBe("yes");
		expect(failure.message).toContain("UpsertMdFile Library/Locked.md");
		expect(harness.contents.get("Library/Missing.md")).toBe("created");
		await Effect.runPromise(dispose);
	});

	it("skips the actions after the first failure when asked to stop", async () => {
		const { dispose, fail, harness } = setup();
		harness.addFile("Library/Locked.md", "locked");
		harness.failingWrites.add("Library/Locked.md");

		const failure = await fail(
			[
				upsert("Library/Locked.md", "changed"),
				upsert("Library/Missing.md", "created"),
			],
			true,
		);

		expect(failure.report.entries.map((entry) => entry.status)).toEqual([
			"Uncertain",
			"Skipped",
		]);
		expect(failure.report.touchedVault).toBe("unknown");
		expect(failure.message).toContain("1 later action(s) skipped");
		expect(harness.exists("Library/Missing.md")).toBe(false);
		await Effect.runPromise(dispose);
	});

	it("reports a content conflict inside ProcessMdFile as a failure that wrote nothing", async () => {
		const { dispose, fail, harness } = setup();
		const note = harness.addFile("Library/Note.md", "before");

		const failure = await fail([
			process("Library/Note.md", async (content) => {
				harness.editByHand(note, "typed meanwhile");
				return `${content} and after`;
			}),
		]);

		expect(failure.reason).toBeInstanceOf(VamDispatchError);
		const [failed] = failure.report.failed;
		expect(failed?.kind).toBe("conflict");
		expect(failed?.cause).toBeInstanceOf(VamContentConflictError);
		expect(failure.report.entries.map((entry) => entry.status)).toEqual([
			"Failed",
		]);
		expect(failure.report.touchedVault).toBe("no");
		expect(isContentConflict(failure)).toBe(true);
		expect(harness.contents.get("Library/Note.md")).toBe("typed meanwhile");
		await Effect.runPromise(dispose);
	});

	it("reports a missing folder as a failure that wrote nothing", async () => {
		const { dispose, fail, harness } = setup();
		harness.addFile("Library/Note.md", "note");

		const failure = await fail([
			{
				kind: VaultActionKind.RenameFolder,
				payload: {
					from: folder("Library/Gone"),
					to: folder("Library/Elsewhere"),
				},
			},
		]);

		expect(failure.report.failed[0]?.kind).toBe("missing");
		expect(failure.report.touchedVault).toBe("no");
		expect(isContentConflict(failure)).toBe(false);
		await Effect.runPromise(dispose);
	});

	it("reports a dispatch after shutdown with every action skipped", async () => {
		const { dispose, fail } = setup();
		await Effect.runPromise(dispose);
		const actions = [upsert("Library/Note.md", "new")];

		const failure = await fail(actions);

		expect(failure).toBeInstanceOf(VamDispatchFailure);
		expect(failure.reason).toBeInstanceOf(VamShutdownError);
		expect(failure.report.skipped).toEqual(actions);
		expect(failure.report.touchedVault).toBe("no");
	});

	it("keeps dispatch and dispatchStopOnFirstFailure void, failing with the report", async () => {
		const { dispose, harness, manager } = setup();
		harness.addFile("Library/Locked.md", "locked");
		harness.failingWrites.add("Library/Locked.md");

		const done = await Effect.runPromise(
			manager.dispatch([upsert("Library/Fine.md", "fine")], {
				caller: "test",
			}),
		);
		const failure = await Effect.runPromise(
			manager
				.dispatchStopOnFirstFailure(
					[
						upsert("Library/Locked.md", "changed"),
						upsert("Library/Later.md", "later"),
					],
					{ caller: "test" },
				)
				.pipe(Effect.flip),
		);

		expect(done).toBeUndefined();
		expect(failure.report.skipped).toEqual([
			upsert("Library/Later.md", "later"),
		]);
		await Effect.runPromise(dispose);
	});
});

describe("notRunCause", () => {
	const operation = { caller: "test", operationId: "test#1" };
	const actions = [upsert("Library/Note.md", "new")];
	const shutdown = new VamShutdownError({
		cause: new Error("Vault Action Manager has been shut down"),
		operation: "provide",
	});
	const setupError = new VamSetupError({
		cause: new Error("no vault"),
		operation: "build",
	});
	const defect = new Error("finalizer exploded");

	it("keeps a defect beside a shutdown error, after the notRun failure that replaces it", async () => {
		const cause = notRunCause(
			Cause.fromReasons([
				Cause.makeFailReason(shutdown),
				Cause.makeDieReason(defect),
			]),
			actions,
			operation,
		);

		const [first, second, ...rest] = cause.reasons;
		expect(rest).toEqual([]);
		if (!(first && Cause.isFailReason(first)))
			throw new Error("expected the notRun failure first");
		expect(first.error).toBeInstanceOf(VamDispatchFailure);
		expect(first.error.reason).toBe(shutdown);
		expect(first.error.report.skipped).toEqual(actions);
		expect(first.error.report.operationId).toBe("test#1");
		expect(second && Cause.isDieReason(second) && second.defect).toBe(
			defect,
		);
		const caught = await Effect.runPromise(
			Effect.failCause(cause).pipe(Effect.flip),
		);
		expect(caught).toBe(first.error);
	});

	it("turns every setup or shutdown error into a notRun failure where it stood, and leaves out interruptions beside them", () => {
		const cause = notRunCause(
			Cause.fromReasons<VamSetupError | VamShutdownError>([
				Cause.makeDieReason(defect),
				Cause.makeFailReason(setupError),
				Cause.makeInterruptReason(7),
				Cause.makeFailReason(shutdown),
			]),
			actions,
			operation,
		);

		expect(
			cause.reasons.map((reason) =>
				Cause.isFailReason(reason)
					? reason.error.reason
					: Cause.isDieReason(reason)
						? reason.defect
						: reason._tag,
			),
		).toEqual([defect, setupError, shutdown]);
	});

	it("passes a cause without a setup or shutdown error on whole, interruptions included", () => {
		const failure = VamDispatchFailure.notRun(shutdown, actions, operation);
		const cause = notRunCause(
			Cause.fromReasons([
				Cause.makeFailReason(failure),
				Cause.makeInterruptReason(7),
				Cause.makeDieReason(defect),
			]),
			actions,
			operation,
		);

		const [first, second, third] = cause.reasons;
		expect(cause.reasons).toHaveLength(3);
		expect(first && Cause.isFailReason(first) && first.error).toBe(failure);
		expect(second && Cause.isInterruptReason(second)).toBe(true);
		expect(third && Cause.isDieReason(third) && third.defect).toBe(defect);
	});
});
