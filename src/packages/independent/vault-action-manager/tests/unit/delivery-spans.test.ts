/**
 * Each delivery to a subscriber runs as a root span of its own,
 * `vam.observation.deliver`, linked to the subscription and to every
 * Dispatch Batch that caused a callback it delivers. A subscriber's failure
 * is logged in that span with its whole cause, and the next delivery still
 * comes. An action's defect keeps every reason of its cause.
 */
import { describe, expect, it } from "bun:test";
import {
	type SplitPathToFolder,
	type SplitPathToMdFile,
	splitPathCodec,
	type VaultAction,
	VaultActionKind,
	VaultActionManager,
	type VaultActionManagerSubscription,
} from "@textfresser/vault-action-manager";
import {
	makeRecentTrace,
	type RecentTrace,
	type RecordedSpan,
} from "@textfresser/vault-action-manager/diagnostics";
import {
	Cause,
	Effect,
	Exit,
	Layer,
	Logger,
	ManagedRuntime,
	Option,
	Tracer,
} from "effect";
import { TFolder } from "obsidian";
import { VamDispatchFailure } from "../../src/effect/dispatch-report";
import { VamDispatchError } from "../../src/effect/errors";
import type { VamLiveServices } from "../../src/effect/ports";
import { VaultIo } from "../../src/effect/ports";
import { DispatchBatchCoordinator } from "../../src/impl/actions-processing/dispatch-batch";
import type { Executor } from "../../src/impl/actions-processing/executor";
import type { SelfEventTracker } from "../../src/impl/event-processing/self-event-tracker";
import { makeObsidianVault } from "./helpers/obsidian-vault";
import { TEST_OPERATION } from "./helpers/self-events";
import {
	createVamRuntime,
	startCoordinator,
	unusedVaultIoMembers,
} from "./helpers/vam-runtime";

const md = (path: string) => splitPathCodec.parse(path) as SplitPathToMdFile;
const folder = (path: string) =>
	splitPathCodec.parse(path) as SplitPathToFolder;

const renameMd = (from: string, to: string): VaultAction => ({
	kind: VaultActionKind.RenameMdFile,
	payload: { from: md(from), onCollision: "fail", to: md(to) },
});

const create = (path: string, content: string): VaultAction => ({
	kind: VaultActionKind.CreateMdFile,
	payload: { content, splitPath: md(path) },
});

type Vault = ReturnType<typeof makeObsidianVault>;

/**
 * Runs `program` on a host runtime whose tracer and logger record into a
 * ring, with VAM's Layer over `vault`, and answers the ring.
 */
async function traced(
	vault: Vault,
	program: Effect.Effect<void, unknown, VaultActionManager>,
	trace: RecentTrace = makeRecentTrace(),
): Promise<RecentTrace> {
	const runtime = ManagedRuntime.make(
		VaultActionManager.layer(vault.app, { observability: "host" }).pipe(
			Layer.provideMerge(
				Layer.mergeAll(
					Layer.succeed(Tracer.Tracer, trace.tracer),
					Logger.layer([trace.logger]),
				),
			),
		),
	);
	try {
		await runtime.runPromise(program);
	} finally {
		await runtime.dispose();
	}
	return trace;
}

const spansNamed = (trace: RecentTrace, name: string): RecordedSpan[] =>
	trace.snapshot().spans.filter((span) => span.name === name);

function only(trace: RecentTrace, name: string): RecordedSpan {
	const found = spansNamed(trace, name);
	expect(found).toHaveLength(1);
	const [span] = found;
	if (!span) throw new Error(`no ${name} span`);
	return span;
}

function ancestors(trace: RecentTrace, span: RecordedSpan): string[] {
	const byId = new Map(
		trace.snapshot().spans.map((each) => [each.spanId, each]),
	);
	const names: string[] = [];
	for (
		let parent = span.parentId ? byId.get(span.parentId) : undefined;
		parent;
		parent = parent.parentId ? byId.get(parent.parentId) : undefined
	)
		names.push(parent.name);
	return names;
}

/** The batch span of the dispatch whose operation is `operationId`. */
function batchSpan(trace: RecentTrace, operationId: string): RecordedSpan {
	const found = spansNamed(trace, "DispatchBatch.executeBatch").filter(
		(span) => span.attributes?.get("vam.operationId") === operationId,
	);
	expect(found).toHaveLength(1);
	const [span] = found;
	if (!span) throw new Error(`no batch span for ${operationId}`);
	return span;
}

describe("Delivery spans", () => {
	it("delivers a Scroll's rename to a Librarian-style subscriber as a root span linked to the rename's dispatch", async () => {
		const vault = makeObsidianVault({ "Library/Story.md": "story" });
		const ring = makeRecentTrace();
		let openWhileSubscribed: string[] = [];
		const trace = await traced(
			vault,
			Effect.gen(function* () {
				const vam = yield* VaultActionManager;
				yield* vam.startListening();
				const subscription = yield* vam
					.scanAndSubscribe(
						folder("Library"),
						{ onBulk: () => Effect.void },
						{ caller: "librarian", from: "allButMine" },
					)
					.pipe(Effect.withSpan("Librarian.init"));
				yield* subscription.start;
				yield* vam
					.dispatch(
						[renameMd("Library/Story.md", "Library/Tale.md")],
						{
							caller: "dictionary",
							operationId: "dictionary#7",
						},
					)
					.pipe(Effect.withSpan("command.rename"));
				yield* vam.testing.whenSettled();
				openWhileSubscribed = ring
					.snapshot()
					.running.map((span) => span.name);
				yield* subscription.close;
			}),
			ring,
		);

		expect(vault.files()).toEqual(["Library/Tale.md"]);
		const delivery = only(trace, "vam.observation.deliver");
		// A root: not under the subscriber's startup, nor the dispatch.
		expect(delivery.parentId).toBeUndefined();
		expect(delivery.status).toBe("ok");
		const batch = batchSpan(trace, "dictionary#7");
		expect(ancestors(trace, batch)).toContain("command.rename");
		const subscribe = spansNamed(trace, "VaultObservation.subscribe").find(
			(span) => ancestors(trace, span).includes("Librarian.init"),
		);
		if (!subscribe) throw new Error("no subscription span");
		expect(delivery.linkIds).toEqual([subscribe.spanId, batch.spanId]);
		expect(Object.fromEntries(delivery.attributes ?? [])).toMatchObject({
			"vam.callbacks": 1,
			"vam.events": 1,
			"vam.operationIds": "dictionary#7",
			"vam.origin": "Vam",
			"vam.roots": 1,
			"vam.subscriber.filter": "allButMine:librarian",
		});
		// No span stays open while the subscription lives, but the caller's.
		expect(openWhileSubscribed).toEqual([]);
	});

	it("links Obsidian's link rewrite after a VAM rename to the rename's dispatch", async () => {
		const vault = makeObsidianVault({
			"Library/Story.md": "story",
			"Notes/Index.md": "See [[Story]]",
		});
		vault.linkTo("Notes/Index.md", "Library/Story.md");
		const trace = await traced(
			vault,
			Effect.gen(function* () {
				const vam = yield* VaultActionManager;
				yield* vam.startListening();
				// Hears the rename, so its Self Events settle; delivers nothing.
				yield* vam.subscribeToBulk(() => Effect.void);
				yield* vam.subscribeToMdModifications(
					folder("Notes"),
					() => Effect.void,
				);
				yield* vam.dispatch(
					[renameMd("Library/Story.md", "Library/Tale.md")],
					{ caller: "librarian", operationId: "librarian#3" },
				);
				yield* vam.testing.whenSettled();
			}),
		);

		expect(vault.content("Notes/Index.md")).toContain("Tale");
		const delivery = only(trace, "vam.observation.deliver");
		expect(delivery.parentId).toBeUndefined();
		expect(delivery.linkIds).toContain(
			batchSpan(trace, "librarian#3").spanId,
		);
		expect(Object.fromEntries(delivery.attributes ?? [])).toMatchObject({
			"vam.modifications": 1,
			"vam.operationIds": "librarian#3",
			"vam.origin": "LinkUpdate",
		});
	});

	it("links a window coalescing two dispatches and a hand edit to each dispatch once", async () => {
		const vault = makeObsidianVault({ "Library/a.md": "a" });
		const trace = await traced(
			vault,
			Effect.gen(function* () {
				const vam = yield* VaultActionManager;
				yield* vam.startListening();
				yield* vam.subscribeToBulk(() => Effect.void, { from: "all" });
				yield* vam.dispatch(
					[create("Library/b.md", "b"), create("Library/c.md", "c")],
					{ caller: "one", operationId: "one#1" },
				);
				yield* vam.dispatch([create("Library/d.md", "d")], {
					caller: "two",
					operationId: "two#1",
				});
				yield* Effect.promise(() =>
					vault.renameByHand("Library/a.md", "Library/z.md"),
				);
				yield* vam.testing.whenSettled();
			}),
		);

		const delivery = only(trace, "vam.observation.deliver");
		const subscribe = only(trace, "VaultObservation.subscribe");
		expect(delivery.linkIds).toEqual([
			subscribe.spanId,
			batchSpan(trace, "one#1").spanId,
			batchSpan(trace, "two#1").spanId,
		]);
		expect(Object.fromEntries(delivery.attributes ?? [])).toMatchObject({
			"vam.callbacks": 4,
			"vam.operationIds": "one#1,two#1",
			"vam.origin": "External,Vam",
		});
	});

	it("delivers a folder's Markdown subscriber only windows with a change below it, linked only to their batches", async () => {
		const vault = makeObsidianVault({
			"Library/a.md": "a",
			"Notes/n.md": "n",
		});
		const heard: string[][] = [];
		const trace = await traced(
			vault,
			Effect.gen(function* () {
				const vam = yield* VaultActionManager;
				yield* vam.startListening();
				yield* vam.subscribeToMdModifications(
					folder("Notes"),
					(event) =>
						Effect.sync(() =>
							heard.push(
								event.modifications.map(({ splitPath }) =>
									splitPathCodec.format(splitPath),
								),
							),
						),
					{ from: "all" },
				);
				// Only outside the folder: no delivery at all.
				yield* vam.dispatch(
					[
						{
							kind: VaultActionKind.ProcessMdFile,
							payload: {
								splitPath: md("Library/a.md"),
								transform: (content) => `${content}!`,
							},
						},
					],
					{ caller: "library", operationId: "library#1" },
				);
				yield* vam.testing.whenSettled();
				// Both: the delivery holds, and links to, the change below it.
				yield* vam.dispatch(
					[
						{
							kind: VaultActionKind.ProcessMdFile,
							payload: {
								splitPath: md("Library/a.md"),
								transform: (content) => `${content}?`,
							},
						},
					],
					{ caller: "library", operationId: "library#2" },
				);
				vault.editByHand("Notes/n.md", "n!");
				yield* vam.testing.whenSettled();
			}),
		);

		expect(heard).toEqual([["Notes/n.md"]]);
		const delivery = only(trace, "vam.observation.deliver");
		expect(delivery.linkIds).toEqual([
			only(trace, "VaultObservation.subscribe").spanId,
		]);
		expect(Object.fromEntries(delivery.attributes ?? [])).toMatchObject({
			"vam.callbacks": 1,
			"vam.modifications": 1,
			"vam.origin": "External",
		});
	});

	it("links an external change to the subscription alone", async () => {
		const vault = makeObsidianVault({ "Library/a.md": "a" });
		const trace = await traced(
			vault,
			Effect.gen(function* () {
				const vam = yield* VaultActionManager;
				yield* vam.startListening();
				yield* vam.subscribeToBulk(() => Effect.void);
				yield* Effect.promise(() =>
					vault.renameByHand("Library/a.md", "Library/z.md"),
				);
				yield* vam.testing.whenSettled();
			}),
		);

		const delivery = only(trace, "vam.observation.deliver");
		expect(delivery.parentId).toBeUndefined();
		expect(delivery.linkIds).toEqual([
			only(trace, "VaultObservation.subscribe").spanId,
		]);
		expect(delivery.attributes?.get("vam.origin")).toBe("External");
		expect(delivery.attributes?.has("vam.operationIds")).toBe(false);
	});

	it("logs a subscriber's failure in its delivery span with the whole cause, and delivers the next window in order", async () => {
		const vault = makeObsidianVault({ "Library/a.md": "a" });
		const handled: string[] = [];
		let subscription: VaultActionManagerSubscription | undefined;
		const trace = await traced(
			vault,
			Effect.gen(function* () {
				const vam = yield* VaultActionManager;
				yield* vam.startListening();
				subscription = yield* vam.subscribeToBulk((event) => {
					const [root] = event.roots;
					const to = root && "to" in root ? root.to.basename : "?";
					handled.push(to);
					return to === "b"
						? Effect.fail(new Error("heal failed")).pipe(
								Effect.ensuring(
									Effect.die(new Error("cleanup died")),
								),
							)
						: Effect.void;
				});
				yield* Effect.promise(() =>
					vault.renameByHand("Library/a.md", "Library/b.md"),
				);
				yield* vam.testing.whenSettled();
				yield* Effect.promise(() =>
					vault.renameByHand("Library/b.md", "Library/c.md"),
				);
				yield* vam.testing.whenSettled();
			}),
		);

		expect(subscription).toBeDefined();
		expect(handled).toEqual(["b", "c"]);
		const [failed, next] = spansNamed(trace, "vam.observation.deliver");
		expect(failed?.status).toBe("failed");
		expect(next?.status).toBe("ok");
		const logs = trace
			.snapshot()
			.logs.filter((log) =>
				log.text.includes("[VaultObservation] Subscriber failed"),
			);
		expect(logs).toHaveLength(1);
		expect(logs[0]?.spanId).toBe(failed?.spanId);
		expect(logs[0]?.cause).toContain("heal failed");
		expect(logs[0]?.cause).toContain("cleanup died");
	});
});

describe("An action's failure keeps its whole cause", () => {
	const action = create("Library/a.md", "a");

	async function dispatchWith(
		execute: Executor["execute"],
	): Promise<VamDispatchFailure> {
		const runtime = createVamRuntime(
			Layer.succeed(VaultIo, {
				...unusedVaultIoMembers,
				// The folder is there, so the batch is the create alone.
				getAbstractFileByPath: (path: string) =>
					Effect.succeed(path === "Library" ? new TFolder() : null),
			} as unknown as VaultIo["Service"]) as unknown as Layer.Layer<VamLiveServices>,
		);
		const coordinator = startCoordinator(
			runtime,
			new DispatchBatchCoordinator(
				{ execute } as unknown as Executor,
				{
					beginEffect: () => Effect.void,
					finishEffect: () => Effect.void,
				} as unknown as SelfEventTracker,
			),
		);
		try {
			const exit = await runtime.runPromiseExit(
				coordinator.dispatchEffect([action], {
					operation: TEST_OPERATION,
				}),
			);
			const failure = Exit.isFailure(exit)
				? Option.getOrUndefined(Cause.findErrorOption(exit.cause))
				: undefined;
			if (!(failure instanceof VamDispatchFailure))
				throw new Error("expected a VamDispatchFailure");
			return failure;
		} finally {
			await Effect.runPromise(coordinator.shutdownEffect());
			await runtime.dispose();
		}
	}

	it("reports a defect and a finalizer's defect together", async () => {
		const failure = await dispatchWith(() =>
			Effect.die(new Error("create exploded")).pipe(
				Effect.ensuring(Effect.die(new Error("cleanup exploded"))),
			),
		);

		const [entry] = failure.report.entries;
		expect(entry?.status).toBe("Uncertain");
		const error = failure.reason;
		expect(error).toBeInstanceOf(VamDispatchError);
		if (!(error instanceof VamDispatchError)) return;
		expect(error.kind).toBe("defect");
		expect(Cause.isCause(error.cause)).toBe(true);
		if (!Cause.isCause(error.cause)) return;
		expect(
			error.cause.reasons
				.filter(Cause.isDieReason)
				.map(({ defect }) =>
					defect instanceof Error ? defect.message : defect,
				),
		).toEqual(["create exploded", "cleanup exploded"]);
		expect(failure.message).toContain("create exploded");
		expect(failure.message).toContain("cleanup exploded");
	});

	it("keeps an action's own failure, and its kind, beside a finalizer's defect", async () => {
		const exists = new VamDispatchError({
			action,
			cause: new Error("taken"),
			kind: "exists",
			operation: "createMdFile",
		});
		const failure = await dispatchWith(() =>
			Effect.fail(exists).pipe(
				Effect.ensuring(Effect.die(new Error("cleanup exploded"))),
			),
		);

		const [entry] = failure.report.entries;
		expect(entry?.status).toBe("Failed");
		const error = failure.reason;
		expect(error).toBeInstanceOf(VamDispatchError);
		if (!(error instanceof VamDispatchError)) return;
		expect(error.kind).toBe("exists");
		expect(Cause.isCause(error.cause)).toBe(true);
		if (!Cause.isCause(error.cause)) return;
		expect(error.cause.reasons.find(Cause.isFailReason)?.error).toBe(
			exists,
		);
		expect(error.cause.reasons.some(Cause.isDieReason)).toBe(true);
		expect(failure.message).toContain("cleanup exploded");
	});

	it("reports an interrupted action as interrupted, not as a defect", async () => {
		const failure = await dispatchWith(() => Effect.interrupt);

		const [entry] = failure.report.entries;
		expect(entry?.status).toBe("Uncertain");
		const error = failure.reason;
		expect(error).toBeInstanceOf(VamDispatchError);
		if (!(error instanceof VamDispatchError)) return;
		expect(error.kind).toBe("interrupted");
		expect(
			Cause.isCause(error.cause) && Cause.hasInterruptsOnly(error.cause),
		).toBe(true);
	});
});
