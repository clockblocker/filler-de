import { afterEach, describe, expect, it } from "bun:test";
import { Cause, Effect, Exit, Fiber, Layer, Option, Tracer } from "effect";
import { type TAbstractFile, TFile, TFolder } from "obsidian";
import { MAX_PENDING_DISPATCH_BATCHES } from "../../src/effect/dispatch-coordinator";
import {
	VamDispatchError,
	VamDispatchOverflowError,
	VamDispatchStoppedError,
	VamPlanningError,
	type VamSetupError,
	VamShutdownError,
	VamVaultIoError,
} from "../../src/effect/errors";
import { type VamLiveServices, VaultIo } from "../../src/effect/ports";
import { createVamRuntime, type VamRuntime } from "../../src/effect/runtime";
import {
	DispatchBatchCoordinator,
	type DispatchBatchOptions,
} from "../../src/impl/actions-processing/dispatch-batch";
import type { Executor } from "../../src/impl/actions-processing/executor";
import type { SelfEventTracker } from "../../src/impl/event-processing/self-event-tracker";
import { MD } from "../../src/types/literals";
import type {
	SplitPathToFolder,
	SplitPathToMdFile,
} from "../../src/types/split-path";
import type { VaultAction } from "../../src/types/vault-action";
import { VaultActionKind } from "../../src/types/vault-action";

const mdFile = (basename: string): SplitPathToMdFile => ({
	basename,
	extension: MD,
	kind: "MdFile",
	pathParts: ["Library"],
});

const makeAction = (basename: string): VaultAction => ({
	kind: VaultActionKind.UpsertMdFile,
	payload: { splitPath: mdFile(basename) },
});

const folder = (basename: string): SplitPathToFolder => ({
	basename,
	kind: "Folder",
	pathParts: [],
});

function deferred(): { promise: Promise<void>; resolve: () => void } {
	let resolve: () => void = () => {};
	const promise = new Promise<void>((resolvePromise) => {
		resolve = resolvePromise;
	});
	return { promise, resolve };
}

/**
 * Counts accepted submissions through the coordinator's test signal, so tests
 * can wait until a number of batches are queued or waiting.
 */
function submissions() {
	const counts = { queued: 0, waiting: 0 };
	const listeners: (() => void)[] = [];
	const onSubmitted = (placement: "queued" | "waiting") => {
		counts[placement]++;
		for (const listener of listeners.splice(0)) listener();
	};
	const until = (
		predicate: (current: typeof counts) => boolean,
	): Promise<void> =>
		new Promise((resolve) => {
			const check = () => {
				if (predicate(counts)) resolve();
				else listeners.push(check);
			};
			check();
		});
	return {
		onSubmitted,
		total: (count: number) =>
			until((current) => current.queued + current.waiting >= count),
		waiting: (count: number) =>
			until((current) => current.waiting >= count),
	};
}

function actionBasename(action: VaultAction): string {
	if (action.kind !== VaultActionKind.UpsertMdFile) {
		throw new Error(`Expected UpsertMdFile, received ${action.kind}`);
	}
	return action.payload.splitPath.basename;
}

type AbstractFileLookup = (
	path: string,
) => Effect.Effect<TAbstractFile | null, VamVaultIoError>;

function makeFolder(path: string): TFolder {
	const value = new TFolder();
	value.path = path;
	value.name = path.split("/").at(-1) ?? path;
	value.children = [];
	return value;
}

function makeFile(path: string): TFile {
	const value = new TFile();
	value.path = path;
	const name = path.split("/").at(-1) ?? path;
	value.basename = name.replace(/\.[^.]+$/, "");
	value.extension = name.includes(".") ? (name.split(".").at(-1) ?? "") : "";
	return value;
}

const defaultLookup: AbstractFileLookup = (path) =>
	Effect.succeed(path.endsWith(".md") ? makeFile(path) : makeFolder(path));

function makeVamLayer(
	lookup: AbstractFileLookup = defaultLookup,
): Layer.Layer<VamLiveServices, VamSetupError> {
	const vault = VaultIo.of({
		create: () => Effect.die("not used"),
		createFolder: () => Effect.die("not used"),
		getAbstractFileByPath: lookup,
		getMarkdownFiles: Effect.die("not used"),
		modify: () => Effect.die("not used"),
		process: () => Effect.die("not used"),
		read: () => Effect.die("not used"),
		rename: () => Effect.die("not used"),
		resolveLinkpathDest: () => Effect.die("not used"),
		stat: () => Effect.die("not used"),
		trash: () => Effect.die("not used"),
	});
	return Layer.succeed(VaultIo, vault) as unknown as Layer.Layer<
		VamLiveServices,
		VamSetupError
	>;
}

function makeCoordinator(
	execute: (
		action: VaultAction,
	) => Promise<unknown> | Effect.Effect<unknown, unknown>,
	options?: DispatchBatchOptions,
	begin: (action: VaultAction) => void = () => {},
	runtime: VamRuntime = createVamRuntime(makeVamLayer()),
	finish: (action: VaultAction) => void = () => {},
) {
	const executor = {
		execute: (action: VaultAction) =>
			Effect.suspend(() => {
				const result = execute(action);
				return Effect.isEffect(result)
					? result
					: Effect.tryPromise({
							catch: (cause) => cause,
							try: () => result,
						});
			}),
	} as unknown as Executor;
	const selfEvents = {
		beginEffect: (action: VaultAction) => Effect.sync(() => begin(action)),
		finishEffect: (action: VaultAction) =>
			Effect.sync(() => finish(action)),
	} as unknown as SelfEventTracker;
	const coordinator = new DispatchBatchCoordinator(
		executor,
		selfEvents,
		runtime,
		options,
	);
	runtimes.set(coordinator, runtime);
	coordinators.push(coordinator);
	return coordinator;
}

const coordinators: DispatchBatchCoordinator[] = [];
const runtimes = new WeakMap<DispatchBatchCoordinator, VamRuntime>();

function runNative<A, E>(
	coordinator: DispatchBatchCoordinator,
	effect: Effect.Effect<A, E>,
) {
	const runtime = runtimes.get(coordinator);
	if (!runtime) throw new Error("Missing VAM runtime for coordinator");
	return runtime.runPromiseExit(effect);
}

function firstFailure(exit: Exit.Exit<unknown, unknown>): unknown {
	if (Exit.isSuccess(exit)) return undefined;
	return Option.getOrUndefined(Cause.findErrorOption(exit.cause));
}

function isDescendantOf(
	spans: readonly Tracer.NativeSpan[],
	span: Tracer.NativeSpan,
	ancestor: Tracer.NativeSpan,
): boolean {
	let current = span;
	while (Option.isSome(current.parent)) {
		const parentId = current.parent.value.spanId;
		if (parentId === ancestor.spanId) return true;
		const parent = spans.find((candidate) => candidate.spanId === parentId);
		if (!parent) return false;
		current = parent;
	}
	return false;
}

async function dispatch(
	coordinator: DispatchBatchCoordinator,
	actions: readonly VaultAction[],
): Promise<Exit.Exit<void, unknown>> {
	return runNative(coordinator, coordinator.dispatchEffect(actions));
}

function dispatchFailures(
	exit: Exit.Exit<unknown, unknown>,
): readonly VamDispatchError[] {
	const failure = firstFailure(exit);
	expect(Array.isArray(failure)).toBe(true);
	if (!Array.isArray(failure)) return [];
	for (const item of failure) {
		expect(item).toBeInstanceOf(VamDispatchError);
	}
	return failure.filter(
		(item): item is VamDispatchError => item instanceof VamDispatchError,
	);
}

async function whenIdle(coordinator: DispatchBatchCoordinator): Promise<void> {
	const exit = await runNative(coordinator, coordinator.whenIdleEffect());
	if (Exit.isFailure(exit)) throw Cause.squash(exit.cause);
}

async function shutdown(coordinator: DispatchBatchCoordinator): Promise<void> {
	const exit = await runNative(coordinator, coordinator.shutdownEffect());
	if (Exit.isFailure(exit)) throw Cause.squash(exit.cause);
}

afterEach(async () => {
	const current = coordinators.splice(0);
	for (const coordinator of current) {
		await shutdown(coordinator);
		await runtimes.get(coordinator)?.dispose();
	}
});

describe("DispatchBatchCoordinator", () => {
	it("executes a submitted batch through its single interface", async () => {
		const executed: VaultAction[] = [];
		const coordinator = makeCoordinator(async (action) => {
			executed.push(action);
			return;
		});
		const action = makeAction("note");

		const result = await dispatch(coordinator, [action]);

		expect(Exit.isSuccess(result)).toBe(true);
		expect(executed).toEqual([action]);
	});

	it("executes three queued batches FIFO without interleaving their actions", async () => {
		const firstStarted = deferred();
		const releaseFirst = deferred();
		const executed: string[] = [];
		const coordinator = makeCoordinator(async (action) => {
			const basename = actionBasename(action);
			executed.push(`${basename}:start`);
			if (basename === "first-a") {
				firstStarted.resolve();
				await releaseFirst.promise;
			}
			executed.push(`${basename}:end`);
			return;
		});

		const first = dispatch(coordinator, [
			makeAction("first-a"),
			makeAction("first-b"),
		]);
		await firstStarted.promise;
		const second = dispatch(coordinator, [
			makeAction("second-a"),
			makeAction("second-b"),
		]);
		const third = dispatch(coordinator, [makeAction("third")]);

		expect(executed).toEqual(["first-a:start"]);
		releaseFirst.resolve();
		await Promise.all([first, second, third]);

		expect(executed).toEqual([
			"first-a:start",
			"first-a:end",
			"first-b:start",
			"first-b:end",
			"second-a:start",
			"second-a:end",
			"second-b:start",
			"second-b:end",
			"third:start",
			"third:end",
		]);
	});

	it("succeeds for an empty batch without executor or Self Event work", async () => {
		let executeCount = 0;
		let registerCount = 0;
		const coordinator = makeCoordinator(
			async () => {
				executeCount++;
				return;
			},
			undefined,
			() => {
				registerCount++;
			},
		);

		const result = await dispatch(coordinator, []);

		expect(Exit.isSuccess(result)).toBe(true);
		expect(executeCount).toBe(0);
		expect(registerCount).toBe(0);
	});

	it("returns each queued caller the result of its own submitted batch", async () => {
		let releaseFirst: () => void = () => {};
		let markFirstStarted: () => void = () => {};
		const firstStarted = new Promise<void>((resolve) => {
			markFirstStarted = resolve;
		});
		const firstGate = new Promise<void>((resolve) => {
			releaseFirst = resolve;
		});

		const coordinator = makeCoordinator(async (action) => {
			if (actionBasename(action) === "first") {
				markFirstStarted();
				await firstGate;
				return;
			}
			throw new Error("second batch failed");
		});

		const firstResultPromise = dispatch(coordinator, [makeAction("first")]);
		await firstStarted;
		const secondResultPromise = dispatch(coordinator, [
			makeAction("second"),
		]);
		releaseFirst();

		const [firstResult, secondResult] = await Promise.all([
			firstResultPromise,
			secondResultPromise,
		]);

		expect(Exit.isSuccess(firstResult)).toBe(true);
		const [failure] = dispatchFailures(secondResult);
		expect(actionBasename(failure?.action as VaultAction)).toBe("second");
		expect(failure?.cause).toEqual(new Error("second batch failed"));
	});

	it("continues later submitted batches after an earlier failure", async () => {
		const coordinator = makeCoordinator(async (action) => {
			if (actionBasename(action) === "failed") throw new Error("failed");
		});

		const failed = dispatch(coordinator, [makeAction("failed")]);
		const succeeded = dispatch(coordinator, [makeAction("succeeded")]);

		expect(Exit.isFailure(await failed)).toBe(true);
		expect(Exit.isSuccess(await succeeded)).toBe(true);
	});

	it("accumulates action failures and continues later actions in the batch", async () => {
		const first = makeAction("first-failure");
		const second = makeAction("second-defect");
		const third = makeAction("later-success");
		const executed: VaultAction[] = [];
		const coordinator = makeCoordinator(async (action) => {
			executed.push(action);
			switch (actionBasename(action)) {
				case "first-failure":
					throw new Error("first failed");
				case "second-defect":
					throw new Error("second threw");
				default:
					return;
			}
		});

		const result = await dispatch(coordinator, [first, second, third]);

		expect(executed).toEqual([first, second, third]);
		expect(
			dispatchFailures(result).map((failure) => ({
				action: failure.action,
				cause: failure.cause,
			})),
		).toEqual([
			{ action: first, cause: new Error("first failed") },
			{ action: second, cause: new Error("second threw") },
		]);
	});

	it("opens each action's Self Event window immediately before it runs and closes it when it ends", async () => {
		const fileAction = makeAction("planned");
		const folderAction: VaultAction = {
			kind: VaultActionKind.CreateFolder,
			payload: { splitPath: folder("Library") },
		};
		const name = (action: VaultAction) =>
			action.kind === VaultActionKind.CreateFolder ? "folder" : "file";
		const timeline: string[] = [];
		const coordinator = makeCoordinator(
			async (action) => {
				timeline.push(`execute:${name(action)}`);
				return;
			},
			undefined,
			(action) => {
				timeline.push(`begin:${name(action)}`);
			},
			undefined,
			(action) => {
				timeline.push(`finish:${name(action)}`);
			},
		);

		const result = await dispatch(coordinator, [fileAction, folderAction]);

		expect(Exit.isSuccess(result)).toBe(true);
		expect(timeline).toEqual([
			"begin:folder",
			"execute:folder",
			"finish:folder",
			"begin:file",
			"execute:file",
			"finish:file",
		]);
	});

	it("closes a failed action's window and opens none for actions a stopped batch skips", async () => {
		const failing = makeAction("failing");
		const skipped = makeAction("skipped");
		const timeline: string[] = [];
		const coordinator = makeCoordinator(
			async (action) => {
				timeline.push(`execute:${actionBasename(action)}`);
				if (action === failing) throw new Error("failed");
			},
			undefined,
			(action) => {
				timeline.push(`begin:${actionBasename(action)}`);
			},
			undefined,
			(action) => {
				timeline.push(`finish:${actionBasename(action)}`);
			},
		);

		const result = await runNative(
			coordinator,
			coordinator.dispatchEffect([failing, skipped], {
				stopOnFirstFailure: true,
			}),
		);

		expect(Exit.isFailure(result)).toBe(true);
		expect(timeline).toEqual([
			"begin:failing",
			"execute:failing",
			"finish:failing",
		]);
	});

	it("emits planning and action spans with action kind and path attributes", async () => {
		const spans: Tracer.NativeSpan[] = [];
		const tracer = Tracer.make({
			span: (options) => {
				const span = new Tracer.NativeSpan(options);
				spans.push(span);
				return span;
			},
		});
		const tracerLayer = Layer.merge(
			makeVamLayer(),
			Layer.succeed(Tracer.Tracer, tracer),
		) as unknown as Layer.Layer<VamLiveServices, VamSetupError>;
		const runtime = createVamRuntime(tracerLayer);
		const action = makeAction("traced");
		const coordinator = makeCoordinator(
			async () => {},
			undefined,
			undefined,
			runtime,
		);

		const result = await dispatch(coordinator, [action]);

		expect(Exit.isSuccess(result)).toBe(true);
		const planningSpan = spans.find(
			(span) => span.name === "vam.dispatch.plan",
		);
		const dispatchSpan = spans.find(
			(span) => span.name === "DispatchBatch.dispatch",
		);
		const actionSpan = spans.find(
			(span) => span.name === "vam.dispatch.action",
		);
		const existenceSpan = spans.find(
			(span) => span.name === "vam.dispatch.exists",
		);
		expect(planningSpan?.attributes.get("action.kind")).toBe(
			VaultActionKind.UpsertMdFile,
		);
		expect(planningSpan?.attributes.get("action.path")).toBe(
			"Library/traced.md",
		);
		expect(actionSpan?.attributes.get("action.kind")).toBe(
			VaultActionKind.UpsertMdFile,
		);
		expect(actionSpan?.attributes.get("action.path")).toBe(
			"Library/traced.md",
		);
		expect(existenceSpan?.attributes.get("path")).toBe("Library");
		if (!dispatchSpan || !planningSpan || !actionSpan || !existenceSpan) {
			throw new Error(
				"Expected dispatch, planning, action, and existence spans",
			);
		}
		expect(isDescendantOf(spans, existenceSpan, planningSpan)).toBe(true);
		expect(isDescendantOf(spans, planningSpan, dispatchSpan)).toBe(true);
		expect(isDescendantOf(spans, actionSpan, dispatchSpan)).toBe(true);
	});

	it("treats wrong-kind vault entries as missing prerequisites", async () => {
		const action: VaultAction = {
			kind: VaultActionKind.ProcessMdFile,
			payload: {
				splitPath: mdFile("wrong-kind"),
				transform: (content) => content,
			},
		};
		const runtime = createVamRuntime(
			makeVamLayer((path) => {
				if (path === "Library") return Effect.succeed(makeFile(path));
				if (path === "Library/wrong-kind.md") {
					return Effect.succeed(makeFolder(path));
				}
				return Effect.succeed(null);
			}),
		);
		const executed: VaultAction[] = [];
		const coordinator = makeCoordinator(
			async (planned) => {
				executed.push(planned);
			},
			undefined,
			undefined,
			runtime,
		);

		const processResult = await dispatch(coordinator, [action]);
		const trashResult = await dispatch(coordinator, [
			{
				kind: VaultActionKind.TrashMdFile,
				payload: { splitPath: mdFile("wrong-kind") },
			},
		]);

		expect(Exit.isSuccess(processResult)).toBe(true);
		expect(Exit.isSuccess(trashResult)).toBe(true);
		expect(executed.map((planned) => planned.kind)).toEqual([
			VaultActionKind.CreateFolder,
			VaultActionKind.ProcessMdFile,
		]);
	});

	it("attributes thrown exceptions to the submitted action", async () => {
		const action = makeAction("throws");
		const coordinator = makeCoordinator(async () => {
			throw new Error("boom");
		});

		const result = await dispatch(coordinator, [action]);

		const [failure] = dispatchFailures(result);
		expect(failure?.action).toBe(action);
		expect(failure?.cause).toEqual(new Error("boom"));
	});

	it("retains the typed executor failure and action ownership at the Effect seam", async () => {
		const action = makeAction("typed-defect");
		const cause = new Error("typed boom");
		const executorFailure = new VamDispatchError({
			action,
			cause,
			operation: "execute.UpsertMdFile",
		});
		const runtime = createVamRuntime(makeVamLayer());
		const coordinator = new DispatchBatchCoordinator(
			{
				execute: () => Effect.fail(executorFailure),
			} as unknown as Executor,
			{
				beginEffect: () => Effect.void,
				finishEffect: () => Effect.void,
			} as unknown as SelfEventTracker,
			runtime,
		);
		runtimes.set(coordinator, runtime);
		coordinators.push(coordinator);

		const exit = await runNative(
			coordinator,
			coordinator.dispatchEffect([action]),
		);

		expect(Exit.isFailure(exit)).toBe(true);
		const failure = firstFailure(exit);
		expect(Array.isArray(failure)).toBe(true);
		if (Array.isArray(failure)) {
			expect(failure).toHaveLength(1);
			const dispatchFailure = failure[0];
			expect(dispatchFailure).toBeInstanceOf(VamDispatchError);
			if (dispatchFailure instanceof VamDispatchError) {
				expect(dispatchFailure.action).toBe(action);
				expect(dispatchFailure.cause).toBe(executorFailure);
				expect(executorFailure.cause).toBe(cause);
				expect(dispatchFailure.operation).toBe("executeAction");
			}
		}
	});

	it("turns an executor defect into an action-owned failure and continues", async () => {
		const defectAction = makeAction("native-defect");
		const laterAction = makeAction("after-defect");
		const cause = new Error("native defect");
		const executed: VaultAction[] = [];
		const runtime = createVamRuntime(makeVamLayer());
		const coordinator = new DispatchBatchCoordinator(
			{
				execute: (action: VaultAction) => {
					executed.push(action);
					return action === defectAction
						? Effect.die(cause)
						: Effect.succeed(undefined);
				},
			} as unknown as Executor,
			{
				beginEffect: () => Effect.void,
				finishEffect: () => Effect.void,
			} as unknown as SelfEventTracker,
			runtime,
		);
		runtimes.set(coordinator, runtime);
		coordinators.push(coordinator);

		const exit = await runNative(
			coordinator,
			coordinator.dispatchEffect([defectAction, laterAction]),
		);

		expect(executed).toEqual([defectAction, laterAction]);
		const failure = firstFailure(exit);
		expect(Array.isArray(failure)).toBe(true);
		if (Array.isArray(failure)) {
			expect(failure).toHaveLength(1);
			const dispatchFailure = failure[0];
			expect(dispatchFailure).toBeInstanceOf(VamDispatchError);
			if (dispatchFailure instanceof VamDispatchError) {
				expect(dispatchFailure.action).toBe(defectAction);
				expect(dispatchFailure.cause).toBe(cause);
			}
		}
	});

	it("owns planning failures by the first action without execution or Self Events", async () => {
		const action = makeAction("planning");
		if (action.kind !== VaultActionKind.UpsertMdFile) {
			throw new Error("Expected UpsertMdFile test fixture");
		}
		action.payload.content = "before";
		let executeCount = 0;
		let registerCount = 0;
		const coordinator = makeCoordinator(
			async () => {
				executeCount++;
				return;
			},
			undefined,
			() => {
				registerCount++;
			},
		);

		const result = await dispatch(coordinator, [
			action,
			{
				kind: VaultActionKind.ProcessMdFile,
				payload: {
					splitPath: mdFile("planning"),
					transform: () => {
						throw new Error("planning failed");
					},
				},
			},
		]);

		const failure = firstFailure(result);
		expect(failure).toBeInstanceOf(VamPlanningError);
		if (failure instanceof VamPlanningError) {
			expect(failure.action).toBe(action);
			expect(failure.cause).toEqual(new Error("planning failed"));
			expect(failure.operation).toBe("planDispatchBatch");
			expect(failure.path).toBe("Library/planning.md");
		}
		expect(executeCount).toBe(0);
		expect(registerCount).toBe(0);
	});

	it("retains planning cause and first-action ownership at the Effect seam", async () => {
		const action = makeAction("typed-planning");
		if (action.kind !== VaultActionKind.UpsertMdFile) {
			throw new Error("Expected UpsertMdFile test fixture");
		}
		action.payload.content = "before";
		const cause = new Error("typed planning failed");
		const coordinator = makeCoordinator(async () => {});

		const exit = await runNative(
			coordinator,
			coordinator.dispatchEffect([
				action,
				{
					kind: VaultActionKind.ProcessMdFile,
					payload: {
						splitPath: mdFile("typed-planning"),
						transform: () => {
							throw cause;
						},
					},
				},
			]),
		);

		expect(Exit.isFailure(exit)).toBe(true);
		const failure = firstFailure(exit);
		expect(failure).toBeInstanceOf(VamPlanningError);
		if (failure instanceof VamPlanningError) {
			expect(failure.action).toBe(action);
			expect(failure.cause).toBe(cause);
			expect(failure.operation).toBe("planDispatchBatch");
			expect(failure.path).toBe("Library/typed-planning.md");
		}
	});

	it("attributes vault existence failures to planning without side effects", async () => {
		const action = makeAction("vault-failure");
		const cause = new Error("vault lookup failed");
		const vaultFailure = new VamVaultIoError({
			cause,
			operation: "getAbstractFileByPath",
			path: "Library",
		});
		const runtime = createVamRuntime(
			makeVamLayer(() => Effect.fail(vaultFailure)),
		);
		let executeCount = 0;
		let registerCount = 0;
		const coordinator = makeCoordinator(
			async () => {
				executeCount++;
			},
			undefined,
			() => {
				registerCount++;
			},
			runtime,
		);

		const result = await dispatch(coordinator, [action]);

		const failure = firstFailure(result);
		expect(failure).toBeInstanceOf(VamPlanningError);
		if (failure instanceof VamPlanningError) {
			expect(failure.action).toBe(action);
			expect(failure.cause).toBe(vaultFailure);
			expect(failure.operation).toBe("planDispatchBatch");
			expect(failure.path).toBe("Library");
		}
		expect(vaultFailure.cause).toBe(cause);
		expect(vaultFailure.operation).toBe("getAbstractFileByPath");
		expect(vaultFailure.path).toBe("Library");
		expect(executeCount).toBe(0);
		expect(registerCount).toBe(0);
	});

	it("keeps whenIdle pending until the active and queued batches finish", async () => {
		const firstStarted = deferred();
		const releaseFirst = deferred();
		const secondStarted = deferred();
		const releaseSecond = deferred();
		const coordinator = makeCoordinator(async (action) => {
			if (actionBasename(action) === "first") {
				firstStarted.resolve();
				await releaseFirst.promise;
			} else {
				secondStarted.resolve();
				await releaseSecond.promise;
			}
			return;
		});

		const first = dispatch(coordinator, [makeAction("first")]);
		await firstStarted.promise;
		const second = dispatch(coordinator, [makeAction("second")]);
		let idleResolved = false;
		const idle = whenIdle(coordinator).then(() => {
			idleResolved = true;
		});

		await Promise.resolve();
		expect(idleResolved).toBe(false);
		releaseFirst.resolve();
		await secondStarted.promise;
		await Promise.resolve();
		expect(idleResolved).toBe(false);

		releaseSecond.resolve();
		await Promise.all([first, second, idle]);
		expect(idleResolved).toBe(true);
	});

	it("applies back-pressure instead of dropping batches beyond queue capacity", async () => {
		const firstStarted = deferred();
		const releaseFirst = deferred();
		const executed: string[] = [];
		const coordinator = makeCoordinator(
			async (action) => {
				const basename = actionBasename(action);
				executed.push(basename);
				if (basename === "first") {
					firstStarted.resolve();
					await releaseFirst.promise;
				}
			},
			{ queueCapacity: 2 },
		);

		const first = dispatch(coordinator, [makeAction("first")]);
		await firstStarted.promise;
		const later = ["second", "third", "fourth", "fifth", "sixth"].map(
			(basename) => dispatch(coordinator, [makeAction(basename)]),
		);
		releaseFirst.resolve();

		const results = await Promise.all([first, ...later]);

		expect(results.every((result) => Exit.isSuccess(result))).toBe(true);
		expect(executed).toEqual([
			"first",
			"second",
			"third",
			"fourth",
			"fifth",
			"sixth",
		]);
	});

	it("drains more than the former per-cycle limit without dropping batches", async () => {
		const firstStarted = deferred();
		const releaseFirst = deferred();
		const executed: string[] = [];
		const coordinator = makeCoordinator(async (action) => {
			const basename = actionBasename(action);
			executed.push(basename);
			if (basename === "batch-0") {
				firstStarted.resolve();
				await releaseFirst.promise;
			}
		});
		const basenames = Array.from({ length: 25 }, (_, i) => `batch-${i}`);

		const first = dispatch(coordinator, [makeAction("batch-0")]);
		await firstStarted.promise;
		const later = basenames
			.slice(1)
			.map((basename) => dispatch(coordinator, [makeAction(basename)]));
		releaseFirst.resolve();
		const results = await Promise.all([first, ...later]);

		expect(results.every((result) => Exit.isSuccess(result))).toBe(true);
		expect(executed).toEqual(basenames);
	});

	for (const [label, queueCapacity] of [
		["the default capacity", undefined],
		["a capacity above the ceiling", MAX_PENDING_DISPATCH_BATCHES * 2],
	] as const) {
		it(`waits up to the pending ceiling and fails loudly past it with ${label}`, async () => {
			const firstStarted = deferred();
			const releaseFirst = deferred();
			const executed: string[] = [];
			const signal = submissions();
			const coordinator = makeCoordinator(
				async (action) => {
					const basename = actionBasename(action);
					executed.push(basename);
					if (basename === "active") {
						firstStarted.resolve();
						await releaseFirst.promise;
					}
				},
				{ onSubmitted: signal.onSubmitted, queueCapacity },
			);

			const active = dispatch(coordinator, [makeAction("active")]);
			await firstStarted.promise;
			const pendingBasenames = Array.from(
				{ length: MAX_PENDING_DISPATCH_BATCHES },
				(_, i) => `pending-${i}`,
			);
			const pending = pendingBasenames.map((basename) =>
				dispatch(coordinator, [makeAction(basename)]),
			);
			await signal.total(1 + MAX_PENDING_DISPATCH_BATCHES);

			const overflowAction = makeAction("overflow");
			const overflow = await dispatch(coordinator, [overflowAction]);
			const stoppedOverflow = await runNative(
				coordinator,
				coordinator.dispatchEffect([makeAction("overflow-stop")], {
					stopOnFirstFailure: true,
				}),
			);

			const overflowFailure = firstFailure(overflow);
			expect(overflowFailure).toBeInstanceOf(VamDispatchOverflowError);
			if (overflowFailure instanceof VamDispatchOverflowError) {
				expect(overflowFailure.action).toBe(overflowAction);
				expect(overflowFailure.limit).toBe(
					MAX_PENDING_DISPATCH_BATCHES,
				);
				expect(overflowFailure.operation).toBe("dispatch.overflow");
			}
			expect(firstFailure(stoppedOverflow)).toBeInstanceOf(
				VamDispatchOverflowError,
			);

			releaseFirst.resolve();
			const results = await Promise.all([active, ...pending]);

			expect(results.every((result) => Exit.isSuccess(result))).toBe(
				true,
			);
			expect(executed).toEqual(["active", ...pendingBasenames]);
			expect(
				Exit.isSuccess(
					await dispatch(coordinator, [makeAction("after")]),
				),
			).toBe(true);
		});
	}

	it("withdraws a batch whose caller is interrupted while it waits for queue space", async () => {
		const firstStarted = deferred();
		const releaseFirst = deferred();
		const executed: string[] = [];
		const signal = submissions();
		const coordinator = makeCoordinator(
			async (action) => {
				const basename = actionBasename(action);
				executed.push(basename);
				if (basename === "first") {
					firstStarted.resolve();
					await releaseFirst.promise;
				}
			},
			{ onSubmitted: signal.onSubmitted, queueCapacity: 1 },
		);

		const first = dispatch(coordinator, [makeAction("first")]);
		await firstStarted.promise;
		const queued = dispatch(coordinator, [makeAction("queued")]);
		const interrupted = await runNative(
			coordinator,
			Effect.gen(function* () {
				const fiber = yield* Effect.forkChild(
					coordinator.dispatchEffect([makeAction("withdrawn")]),
				);
				yield* Effect.promise(() => signal.waiting(1));
				return yield* Fiber.interrupt(fiber);
			}),
		);
		const after = dispatch(coordinator, [makeAction("after")]);
		releaseFirst.resolve();

		const results = await Promise.all([first, queued, after]);

		expect(Exit.isSuccess(interrupted)).toBe(true);
		expect(results.every((result) => Exit.isSuccess(result))).toBe(true);
		expect(executed).toEqual(["first", "queued", "after"]);
	});

	it("still runs a batch whose caller is interrupted after it left the waiting list", async () => {
		const firstStarted = deferred();
		const releaseFirst = deferred();
		const blockerStarted = deferred();
		const releaseBlocker = deferred();
		const executed: string[] = [];
		const signal = submissions();
		const coordinator = makeCoordinator(
			async (action) => {
				const basename = actionBasename(action);
				executed.push(basename);
				if (basename === "first") {
					firstStarted.resolve();
					await releaseFirst.promise;
				}
				if (basename === "blocker") {
					blockerStarted.resolve();
					await releaseBlocker.promise;
				}
			},
			{ onSubmitted: signal.onSubmitted, queueCapacity: 2 },
		);

		const first = dispatch(coordinator, [makeAction("first")]);
		await firstStarted.promise;
		const queued = dispatch(coordinator, [makeAction("queued")]);
		const blocker = dispatch(coordinator, [makeAction("blocker")]);
		const interrupted = await runNative(
			coordinator,
			Effect.gen(function* () {
				const fiber = yield* Effect.forkChild(
					coordinator.dispatchEffect([makeAction("admitted")]),
				);
				yield* Effect.promise(() => signal.waiting(1));
				releaseFirst.resolve();
				// The worker admits waiting batches after each completed
				// batch, so once "blocker" runs, "admitted" left the waiting
				// list for the queue slot that "queued" freed.
				yield* Effect.promise(() => blockerStarted.promise);
				return yield* Fiber.interrupt(fiber);
			}),
		);
		releaseBlocker.resolve();

		const results = await Promise.all([first, queued, blocker]);
		await whenIdle(coordinator);

		expect(Exit.isSuccess(interrupted)).toBe(true);
		expect(results.every((result) => Exit.isSuccess(result))).toBe(true);
		expect(executed).toEqual(["first", "queued", "blocker", "admitted"]);
	});

	it("fails batches waiting for queue space on shutdown", async () => {
		const activeStarted = deferred();
		const releaseActive = deferred();
		const executed: string[] = [];
		const signal = submissions();
		const coordinator = makeCoordinator(
			async (action) => {
				const basename = actionBasename(action);
				executed.push(basename);
				if (basename === "active") {
					activeStarted.resolve();
					await releaseActive.promise;
				}
			},
			{ onSubmitted: signal.onSubmitted, queueCapacity: 1 },
		);

		const active = dispatch(coordinator, [makeAction("active")]);
		await activeStarted.promise;
		const queued = dispatch(coordinator, [makeAction("queued")]);
		const waitingAction = makeAction("waiting");
		const waiting = dispatch(coordinator, [waitingAction]);
		await signal.waiting(1);
		const shutdownDone = shutdown(coordinator);
		releaseActive.resolve();

		const [activeExit, queuedExit, waitingExit] = await Promise.all([
			active,
			queued,
			waiting,
		]);
		await shutdownDone;

		expect(Exit.isSuccess(activeExit)).toBe(true);
		expect(firstFailure(queuedExit)).toBeInstanceOf(VamShutdownError);
		const waitingFailure = firstFailure(waitingExit);
		expect(waitingFailure).toBeInstanceOf(VamShutdownError);
		if (
			waitingFailure instanceof VamShutdownError &&
			waitingFailure.cause instanceof Error
		) {
			expect(waitingFailure.cause.cause).toBe(waitingAction);
		}
		expect(executed).toEqual(["active"]);
	});

	it("stops at the first failed action when the batch opts in, reporting executed and skipped actions", async () => {
		const before = makeAction("before");
		const failing = makeAction("failing");
		const skippedA = makeAction("skipped-a");
		const skippedB = makeAction("skipped-b");
		const executed: VaultAction[] = [];
		const cause = new Error("write failed");
		const coordinator = makeCoordinator(async (action) => {
			executed.push(action);
			if (action === failing) throw cause;
		});

		const exit = await runNative(
			coordinator,
			coordinator.dispatchEffect([before, failing, skippedA, skippedB], {
				stopOnFirstFailure: true,
			}),
		);

		expect(executed).toEqual([before, failing]);
		const failure = firstFailure(exit);
		expect(failure).toBeInstanceOf(VamDispatchStoppedError);
		if (failure instanceof VamDispatchStoppedError) {
			expect(failure.executed).toEqual([before]);
			expect(failure.skipped).toEqual([skippedA, skippedB]);
			expect(failure.action).toBe(failing);
			expect(failure.cause).toBe(cause);
			expect(failure.failure).toBeInstanceOf(VamDispatchError);
			expect(failure.failure.action).toBe(failing);
			expect(failure.operation).toBe("dispatch.stopOnFirstFailure");
		}
	});

	it("reports planned prerequisites among executed actions when stopping", async () => {
		const runtime = createVamRuntime(
			makeVamLayer((path) =>
				Effect.succeed(path === "Library" ? null : makeFile(path)),
			),
		);
		const failing = makeAction("failing");
		const skipped = makeAction("skipped");
		const coordinator = makeCoordinator(
			async (action) => {
				if (action === failing) throw new Error("failed");
			},
			undefined,
			undefined,
			runtime,
		);

		const exit = await runNative(
			coordinator,
			coordinator.dispatchEffect([failing, skipped], {
				stopOnFirstFailure: true,
			}),
		);

		const failure = firstFailure(exit);
		expect(failure).toBeInstanceOf(VamDispatchStoppedError);
		if (failure instanceof VamDispatchStoppedError) {
			expect(failure.executed.map((action) => action.kind)).toEqual([
				VaultActionKind.CreateFolder,
			]);
			expect(failure.skipped).toEqual([skipped]);
		}
	});

	it("keeps attempting every action by default and leaves later batches unaffected by a stopped one", async () => {
		const failing = makeAction("failing");
		const later = makeAction("later");
		const executed: VaultAction[] = [];
		const coordinator = makeCoordinator(async (action) => {
			executed.push(action);
			if (action === failing) throw new Error("failed");
		});

		const stopped = await runNative(
			coordinator,
			coordinator.dispatchEffect([failing, later], {
				stopOnFirstFailure: true,
			}),
		);
		const defaulted = await dispatch(coordinator, [failing, later]);

		expect(firstFailure(stopped)).toBeInstanceOf(VamDispatchStoppedError);
		expect(dispatchFailures(defaulted)).toHaveLength(1);
		expect(executed).toEqual([failing, failing, later]);
	});

	it("finishes the active batch, fails queued callers, and rejects later submissions on shutdown", async () => {
		const activeStarted = deferred();
		const releaseActive = deferred();
		const activeAction = makeAction("active");
		const queuedAction = makeAction("queued");
		const anotherQueuedAction = makeAction("another-queued");
		const executed: VaultAction[] = [];
		const coordinator = makeCoordinator(async (action) => {
			executed.push(action);
			if (action === activeAction) {
				activeStarted.resolve();
				await releaseActive.promise;
			}
			return;
		});

		const active = runNative(
			coordinator,
			coordinator.dispatchEffect([activeAction]),
		);
		await activeStarted.promise;
		const queued = runNative(
			coordinator,
			coordinator.dispatchEffect([queuedAction]),
		);
		const anotherQueued = runNative(
			coordinator,
			coordinator.dispatchEffect([anotherQueuedAction]),
		);
		const shutdown = runNative(coordinator, coordinator.shutdownEffect());

		let shutdownResolved = false;
		void shutdown.then(() => {
			shutdownResolved = true;
		});
		await Promise.resolve();
		expect(shutdownResolved).toBe(false);
		releaseActive.resolve();

		const [activeExit, queuedExit, anotherQueuedExit, shutdownExit] =
			await Promise.all([active, queued, anotherQueued, shutdown]);
		expect(Exit.isSuccess(activeExit)).toBe(true);
		const queuedFailure = firstFailure(queuedExit);
		expect(queuedFailure).toBeInstanceOf(VamShutdownError);
		if (
			queuedFailure instanceof VamShutdownError &&
			queuedFailure.cause instanceof Error
		) {
			expect(queuedFailure.cause.cause).toBe(queuedAction);
		}
		expect(firstFailure(anotherQueuedExit)).toBeInstanceOf(
			VamShutdownError,
		);
		expect(Exit.isSuccess(shutdownExit)).toBe(true);
		expect(executed).toEqual([activeAction]);

		const postShutdown = await runNative(
			coordinator,
			coordinator.dispatchEffect([makeAction("post-shutdown")]),
		);
		expect(firstFailure(postShutdown)).toBeInstanceOf(VamShutdownError);
	});
});
