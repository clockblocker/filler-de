import { afterEach, describe, expect, it } from "bun:test";
import { Cause, Effect, Exit, Layer, Option, Tracer } from "effect";
import { err, ok, type Result } from "neverthrow";
import {
	VamDispatchError,
	VamPlanningError,
	type VamSetupError,
	VamShutdownError,
} from "../../src/effect/errors";
import type { VamLiveServices } from "../../src/effect/ports";
import { createVamRuntime, type VamRuntime } from "../../src/effect/runtime";
import {
	DispatchBatchCoordinator,
	type DispatchBatchOptions,
} from "../../src/impl/actions-processing/dispatch-batch";
import type { Executor } from "../../src/impl/actions-processing/executor";
import type { SelfEventTracker } from "../../src/impl/event-processing/self-event-tracker";
import type { DispatchError, DispatchResult } from "../../src/types/dispatch";
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

function actionBasename(action: VaultAction): string {
	if (action.kind !== VaultActionKind.UpsertMdFile) {
		throw new Error(`Expected UpsertMdFile, received ${action.kind}`);
	}
	return action.payload.splitPath.basename;
}

const emptyVamLayer = Layer.empty as unknown as Layer.Layer<
	VamLiveServices,
	VamSetupError
>;

function makeCoordinator(
	execute: (action: VaultAction) => Promise<Result<unknown, string>>,
	options?: DispatchBatchOptions,
	register: (actions: readonly VaultAction[]) => void = () => {},
	runtime: VamRuntime = createVamRuntime(emptyVamLayer),
) {
	const executor = {
		execute: (action: VaultAction) =>
			Effect.tryPromise({
				catch: (cause) => cause,
				try: () => execute(action),
			}).pipe(
				Effect.flatMap((result) =>
					result.isErr()
						? Effect.fail(result.error)
						: Effect.succeed(result.value),
				),
			),
	} as unknown as Executor;
	const selfEvents = {
		registerEffect: (actions: readonly VaultAction[]) =>
			Effect.sync(() => register(actions)),
	} as unknown as SelfEventTracker;
	const coordinator = new DispatchBatchCoordinator(
		executor,
		selfEvents,
		{ exists: () => true },
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

function unwrapTaggedCause(cause: unknown): unknown {
	let current = cause;
	while (
		current instanceof Error &&
		current.message.length === 0 &&
		"cause" in current &&
		current.cause !== current
	) {
		current = current.cause;
	}
	return current;
}

function exceptionMessage(cause: unknown): string {
	return `EXCEPTION: ${cause instanceof Error ? cause.message : String(cause)}`;
}

function compatibilityError(
	failure: VamDispatchError,
	fallback: VaultAction,
): DispatchError {
	const cause = unwrapTaggedCause(failure.cause);
	return {
		action: (failure.action as VaultAction | undefined) ?? fallback,
		error:
			failure.operation === "overflow"
				? String(cause)
				: cause instanceof Error
					? exceptionMessage(cause)
					: String(cause),
	};
}

async function dispatchCompat(
	coordinator: DispatchBatchCoordinator,
	actions: readonly VaultAction[],
): Promise<DispatchResult> {
	const exit = await runNative(
		coordinator,
		coordinator.dispatchEffect(actions),
	);
	if (Exit.isSuccess(exit)) return ok(undefined);

	const representative = actions[0] ?? ({} as VaultAction);
	const failure = firstFailure(exit);
	if (Array.isArray(failure)) {
		return err(
			failure.map((item) =>
				item instanceof VamDispatchError
					? compatibilityError(item, representative)
					: { action: representative, error: exceptionMessage(item) },
			),
		);
	}
	if (failure instanceof VamPlanningError) {
		return err([
			{
				action:
					(failure.action as VaultAction | undefined) ??
					representative,
				error: exceptionMessage(failure.cause),
			},
		]);
	}
	if (failure instanceof VamShutdownError) {
		return err([
			{
				action: representative,
				error: "Vault Action Manager has been disposed",
			},
		]);
	}
	if (failure instanceof VamDispatchError) {
		return err([compatibilityError(failure, representative)]);
	}
	return err([
		{
			action: representative,
			error: `EXCEPTION: ${Cause.pretty(exit.cause)}`,
		},
	]);
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
			return ok(undefined);
		});
		const action = makeAction("note");

		const result = await dispatchCompat(coordinator, [action]);

		expect(result.isOk()).toBe(true);
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
			return ok(undefined);
		});

		const first = dispatchCompat(coordinator, [
			makeAction("first-a"),
			makeAction("first-b"),
		]);
		await firstStarted.promise;
		const second = dispatchCompat(coordinator, [
			makeAction("second-a"),
			makeAction("second-b"),
		]);
		const third = dispatchCompat(coordinator, [makeAction("third")]);

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
				return ok(undefined);
			},
			undefined,
			() => {
				registerCount++;
			},
		);

		const result = await dispatchCompat(coordinator, []);

		expect(result.isOk()).toBe(true);
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
				return ok(undefined);
			}
			return err("second batch failed");
		});

		const firstResultPromise = dispatchCompat(coordinator, [
			makeAction("first"),
		]);
		await firstStarted;
		const secondResultPromise = dispatchCompat(coordinator, [
			makeAction("second"),
		]);
		releaseFirst();

		const [firstResult, secondResult] = await Promise.all([
			firstResultPromise,
			secondResultPromise,
		]);

		expect(firstResult.isOk()).toBe(true);
		expect(secondResult.isErr()).toBe(true);
		if (secondResult.isErr()) {
			expect(secondResult.error).toHaveLength(1);
			expect(
				actionBasename(
					secondResult.error[0]?.action ?? makeAction("missing"),
				),
			).toBe("second");
			expect(secondResult.error[0]?.error).toBe("second batch failed");
		}
	});

	it("continues later submitted batches after an earlier failure", async () => {
		const coordinator = makeCoordinator(async (action) =>
			actionBasename(action) === "failed" ? err("failed") : ok(undefined),
		);

		const failed = dispatchCompat(coordinator, [makeAction("failed")]);
		const succeeded = dispatchCompat(coordinator, [
			makeAction("succeeded"),
		]);

		expect((await failed).isErr()).toBe(true);
		expect((await succeeded).isOk()).toBe(true);
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
					return err("first failed");
				case "second-defect":
					throw new Error("second threw");
				default:
					return ok(undefined);
			}
		});

		const result = await dispatchCompat(coordinator, [
			first,
			second,
			third,
		]);

		expect(executed).toEqual([first, second, third]);
		expect(result.isErr()).toBe(true);
		if (result.isErr()) {
			expect(result.error).toEqual([
				{ action: first, error: "first failed" },
				{ action: second, error: "EXCEPTION: second threw" },
			]);
		}
	});

	it("registers Self Events once in planned order immediately before execution", async () => {
		const fileAction = makeAction("planned");
		const folderAction: VaultAction = {
			kind: VaultActionKind.CreateFolder,
			payload: { splitPath: folder("Library") },
		};
		const timeline: string[] = [];
		const registrations: Array<readonly VaultAction[]> = [];
		const coordinator = makeCoordinator(
			async (action) => {
				timeline.push(
					action.kind === VaultActionKind.CreateFolder
						? "execute:folder"
						: "execute:file",
				);
				return ok(undefined);
			},
			undefined,
			(actions) => {
				registrations.push(actions);
				timeline.push("register");
			},
		);

		const result = await dispatchCompat(coordinator, [
			fileAction,
			folderAction,
		]);

		expect(result.isOk()).toBe(true);
		expect(registrations).toEqual([[folderAction, fileAction]]);
		expect(timeline).toEqual([
			"register",
			"execute:folder",
			"execute:file",
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
		const tracerLayer = Layer.succeed(
			Tracer.Tracer,
			tracer,
		) as unknown as Layer.Layer<VamLiveServices, VamSetupError>;
		const runtime = createVamRuntime(tracerLayer);
		const action = makeAction("traced");
		const coordinator = makeCoordinator(
			async () => ok(undefined),
			undefined,
			undefined,
			runtime,
		);

		const result = await dispatchCompat(coordinator, [action]);

		expect(result.isOk()).toBe(true);
		const planningSpan = spans.find(
			(span) => span.name === "vam.dispatch.plan",
		);
		const actionSpan = spans.find(
			(span) => span.name === "vam.dispatch.action",
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
	});

	it("attributes thrown exceptions to the submitted action", async () => {
		const action = makeAction("throws");
		const coordinator = makeCoordinator(async () => {
			throw new Error("boom");
		});

		const result = await dispatchCompat(coordinator, [action]);

		expect(result.isErr()).toBe(true);
		if (result.isErr()) {
			expect(result.error).toEqual([
				{ action, error: "EXCEPTION: boom" },
			]);
		}
	});

	it("retains the typed executor failure and action ownership at the Effect seam", async () => {
		const action = makeAction("typed-defect");
		const cause = new Error("typed boom");
		const executorFailure = new VamDispatchError({
			action,
			cause,
			operation: "execute.UpsertMdFile",
		});
		const runtime = createVamRuntime(emptyVamLayer);
		const coordinator = new DispatchBatchCoordinator(
			{
				execute: () => Effect.fail(executorFailure),
			} as unknown as Executor,
			{
				registerEffect: () => Effect.void,
			} as unknown as SelfEventTracker,
			{ exists: () => true },
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
		const runtime = createVamRuntime(emptyVamLayer);
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
				registerEffect: () => Effect.void,
			} as unknown as SelfEventTracker,
			{ exists: () => true },
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
				return ok(undefined);
			},
			undefined,
			() => {
				registerCount++;
			},
		);

		const result = await dispatchCompat(coordinator, [
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

		expect(result.isErr()).toBe(true);
		if (result.isErr()) {
			expect(result.error).toEqual([
				{ action, error: "EXCEPTION: planning failed" },
			]);
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
		const coordinator = makeCoordinator(async () => ok(undefined));

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
		}
	});

	it("resolves whenIdle immediately when no batch is active or queued", async () => {
		const coordinator = makeCoordinator(async () => ok(undefined));

		await whenIdle(coordinator);

		expect(true).toBe(true);
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
			return ok(undefined);
		});

		const first = dispatchCompat(coordinator, [makeAction("first")]);
		await firstStarted.promise;
		const second = dispatchCompat(coordinator, [makeAction("second")]);
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

	it("preserves per-drain overflow and returns owned errors to every dropped caller", async () => {
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
				return ok(undefined);
			},
			{ maxBatches: 2 },
		);

		const first = dispatchCompat(coordinator, [makeAction("first")]);
		await firstStarted.promise;
		const second = dispatchCompat(coordinator, [makeAction("second")]);
		const thirdA = makeAction("third-a");
		const thirdB = makeAction("third-b");
		const fourthAction = makeAction("fourth");
		const third = dispatchCompat(coordinator, [thirdA, thirdB]);
		const fourth = dispatchCompat(coordinator, [fourthAction]);
		releaseFirst.resolve();

		const [firstResult, secondResult, thirdResult, fourthResult] =
			await Promise.all([first, second, third, fourth]);

		expect(firstResult.isOk()).toBe(true);
		expect(secondResult.isOk()).toBe(true);
		expect(thirdResult.isErr()).toBe(true);
		if (thirdResult.isErr()) {
			expect(thirdResult.error).toEqual([
				{
					action: thirdA,
					error: "Dispatch Batch overflow: batch limit 2 reached, 2 actions dropped",
				},
			]);
		}
		expect(fourthResult.isErr()).toBe(true);
		if (fourthResult.isErr()) {
			expect(fourthResult.error).toEqual([
				{
					action: fourthAction,
					error: "Dispatch Batch overflow: batch limit 2 reached, 1 actions dropped",
				},
			]);
		}
		expect(executed).toEqual(["first", "second"]);

		const later = await dispatchCompat(coordinator, [makeAction("later")]);
		expect(later.isOk()).toBe(true);
		expect(executed).toEqual(["first", "second", "later"]);
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
			return ok(undefined);
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
