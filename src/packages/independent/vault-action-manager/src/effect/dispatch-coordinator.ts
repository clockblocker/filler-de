import {
	Cause,
	Context,
	Deferred,
	Effect,
	Exit,
	Logger,
	Option,
	Queue,
	SynchronizedRef,
	Tracer,
} from "effect";
import { TFile, TFolder } from "obsidian";
import { formatCause } from "../diagnostics/format-cause";
import {
	CollapseTransformError,
	collapseActions,
} from "../impl/actions-processing/collapse";
import { buildDependencyGraph } from "../impl/actions-processing/dependency-detector";
import {
	ensureDestinationsExist,
	getDestinationsToCheck,
} from "../impl/actions-processing/ensure-requirements-helpers";
import type { Executor } from "../impl/actions-processing/executor";
import { topologicalSort } from "../impl/actions-processing/topological-sort";
import {
	type LinkUpdates,
	linkUpdatingRename,
} from "../impl/event-processing/link-updates";
import type { SelfEventTracker } from "../impl/event-processing/self-event-tracker";
import type { ProtectedPaths } from "../impl/protected-paths";
import { splitPathCodec } from "../split-path-codec";
import type {
	VamCaller,
	VamOperation,
	VamOperationId,
} from "../types/event-origin";
import type {
	AnySplitPath,
	SplitPathToFolder,
	SplitPathToMdFile,
} from "../types/split-path";
import type { VaultAction } from "../types/vault-action";
import { VaultActionKind } from "../types/vault-action";
import {
	CurrentDispatchSpan,
	CurrentTargetCheck,
	CurrentVamOperation,
	type TargetCheck,
} from "./current-operation";
import {
	type VamDispatchEntry,
	VamDispatchFailure,
	VamDispatchReport,
} from "./dispatch-report";
import {
	causeValue,
	VamDispatchError,
	VamDispatchOverflowError,
	VamPlanningError,
	VamProtectedPathError,
	VamShutdownError,
	VamVaultIoError,
} from "./errors";
import { type VamLiveServices, VaultIo } from "./ports";

/** Who dispatches a batch, and under which operation id. */
export type DispatchCaller = {
	/**
	 * The caller's name, such as `"librarian"`. The batch's events carry it
	 * in their `Vam` origin, so a subscription can leave out its own.
	 */
	readonly caller: VamCaller;
	/**
	 * Names the batch in its report, its spans and its events' origins.
	 * VAM makes one when it is not given.
	 */
	readonly operationId?: VamOperationId;
};

/** Per-batch dispatch options. */
export type DispatchOptions = DispatchCaller & {
	/**
	 * Stop at the first failed action instead of attempting the rest of the
	 * batch. The report then lists the remaining planned actions as
	 * `Skipped`. Defaults to `false`.
	 */
	readonly stopOnFirstFailure?: boolean;
};

/** One submission as the worker takes it: its operation already named. */
export type DispatchRequest = {
	readonly operation: VamOperation;
	readonly stopOnFirstFailure?: boolean;
};

type DispatchBatchWorkerOptions = {
	/**
	 * Maximum batches queued behind the active one. Further submissions wait,
	 * in submission order, until the worker frees a slot.
	 */
	readonly queueCapacity?: number;
	/**
	 * Test signal, called once per accepted submission after it is queued or
	 * appended to the waiting list.
	 */
	readonly onSubmitted?: (placement: "queued" | "waiting") => void;
	/**
	 * Paths no batch may change. A submission naming one fails with
	 * `VamProtectedPathError` before anything in it runs.
	 */
	readonly protectedPaths?: ProtectedPaths;
	/** Predicts and labels what link-updating renames make Obsidian rewrite. */
	readonly linkUpdates?: LinkUpdates;
};

const DEFAULT_QUEUE_CAPACITY = 10;

/**
 * Ceiling on batches pending behind the active one, queued or waiting for
 * queue space. Below it, submissions wait; at it, they fail with
 * `VamDispatchOverflowError` so a runaway producer surfaces.
 */
export const MAX_PENDING_DISPATCH_BATCHES = 500;

type BatchMessage = {
	readonly _tag: "Batch";
	readonly actions: readonly VaultAction[];
	readonly completion: Deferred.Deferred<
		VamDispatchReport,
		VamDispatchFailure
	>;
	/**
	 * The submitter's tracer and loggers: the batch runs with them, so its
	 * spans and logs go where the submitter's do, however the worker's own
	 * fiber was set up.
	 */
	readonly observability: Context.Context<never>;
	readonly operation: VamOperation;
	readonly parentSpan: Option.Option<Tracer.Span>;
	readonly stopOnFirstFailure: boolean;
};

type ShutdownMessage = { readonly _tag: "Shutdown" };
type DispatchMessage = BatchMessage | ShutdownMessage;

type Lifecycle = "running" | "shuttingDown" | "shutdown";

type CoordinationState = {
	readonly busy: boolean;
	readonly idle: Deferred.Deferred<void>;
	readonly lifecycle: Lifecycle;
	/** Submitted batches waiting for queue space, in submission order. */
	readonly waiting: readonly BatchMessage[];
};

type WorkerDecision =
	| { readonly _tag: "Continue" }
	| { readonly _tag: "Shutdown" }
	| { readonly _tag: "Wait" };

const shutdownMessage: ShutdownMessage = { _tag: "Shutdown" };

/**
 * Effect-native single-consumer Dispatch Batch coordinator.
 *
 * This class never creates or runs a runtime. Its owner forks `run`, the
 * worker, in a scope of its own (the Vault Action Manager's Layer forks it
 * in the Layer's scope); submissions wait until the worker has started.
 */
export class DispatchBatchWorker {
	private readonly idleSeed = Deferred.makeUnsafe<void>();
	private readonly linkUpdates: DispatchBatchWorkerOptions["linkUpdates"];
	private readonly protectedPaths: DispatchBatchWorkerOptions["protectedPaths"];
	private readonly onSubmitted: DispatchBatchWorkerOptions["onSubmitted"];
	private readonly queueCapacity: number;
	private readonly queueReady =
		Deferred.makeUnsafe<Queue.Queue<DispatchMessage>>();
	private readonly state = SynchronizedRef.makeUnsafe<CoordinationState>({
		busy: false,
		idle: this.idleSeed,
		lifecycle: "running",
		waiting: [],
	});
	private readonly workerDone = Deferred.makeUnsafe<void>();

	/**
	 * Runs as long as VAM, so it opens no span of its own: each batch runs
	 * under its submitter's span.
	 */
	private readonly worker = Effect.fnUntraced(function* (
		self: DispatchBatchWorker,
	) {
		const queue = yield* Queue.unbounded<DispatchMessage>();
		yield* Deferred.succeed(self.queueReady, queue);

		while (true) {
			const message = yield* Queue.take(queue);
			if (message._tag === "Shutdown") break;

			yield* self.completeBatch(message);

			const decision = yield* self.nextDecision(queue);
			if (decision._tag === "Shutdown") {
				yield* self.finishWorker();
				return;
			}
		}

		yield* self.finishWorker();
	});

	private readonly beginShutdown = Effect.fn("DispatchBatch.beginShutdown")(
		function* (
			self: DispatchBatchWorker,
			queue: Queue.Queue<DispatchMessage>,
			state: CoordinationState,
		) {
			const queued = yield* Queue.clear(queue);
			for (const message of [...queued, ...state.waiting]) {
				if (message._tag !== "Batch") continue;
				yield* Deferred.fail(
					message.completion,
					self.shutdownError(
						"dispatch.queued",
						message.actions,
						message.operation,
					),
				);
			}

			const nextState: CoordinationState = state.busy
				? { ...state, lifecycle: "shuttingDown", waiting: [] }
				: {
						...state,
						busy: true,
						idle: Deferred.makeUnsafe<void>(),
						lifecycle: "shuttingDown",
						waiting: [],
					};
			yield* Queue.offer(queue, shutdownMessage);
			return [Deferred.await(self.workerDone), nextState] as const;
		},
	);

	constructor(
		private readonly executor: Executor,
		private readonly selfEventTracker: SelfEventTracker,
		options: DispatchBatchWorkerOptions = {},
	) {
		this.queueCapacity = Math.min(
			MAX_PENDING_DISPATCH_BATCHES,
			Math.max(1, options.queueCapacity ?? DEFAULT_QUEUE_CAPACITY),
		);
		this.onSubmitted = options.onSubmitted;
		this.protectedPaths = options.protectedPaths;
		this.linkUpdates = options.linkUpdates;
	}

	/**
	 * The worker: takes batches one at a time until `shutdownEffect`. Fork it
	 * once, in the scope that owns the coordinator. Should it end any other
	 * way, such as by interruption, it fails every batch it holds with
	 * `VamShutdownError`, so neither a submitter nor a shutdown waits on it.
	 */
	get run(): Effect.Effect<void, never, VamLiveServices> {
		return this.worker(this).pipe(
			Effect.onExit((exit) =>
				Exit.isSuccess(exit) ? Effect.void : this.abandon(),
			),
		);
	}

	/**
	 * Submits one Dispatch Batch and waits for its report.
	 *
	 * When the queue is full, the batch waits for space behind earlier waiting
	 * batches instead of being dropped. Interrupting a caller whose batch is
	 * still waiting withdraws the batch; once queued, it runs to completion.
	 */
	readonly dispatchEffect = Effect.fn("vam.dispatch")(function* (
		this: DispatchBatchWorker,
		actions: readonly VaultAction[],
		request: DispatchRequest,
	): Effect.fn.Return<VamDispatchReport, VamDispatchFailure> {
		const submitted = [...actions];
		const { operation } = request;
		yield* Effect.annotateCurrentSpan(operationAttributes(operation));
		yield* this.refuseProtected(submitted, operation);
		const queue = yield* Deferred.await(this.queueReady);
		const parentSpan = yield* Effect.option(Effect.currentSpan);
		const observability = Context.make(
			Tracer.Tracer,
			yield* Effect.tracer,
		).pipe(
			Context.add(Logger.CurrentLoggers, yield* Logger.CurrentLoggers),
		);
		const completion = yield* Deferred.make<
			VamDispatchReport,
			VamDispatchFailure
		>();
		const batch: BatchMessage = {
			_tag: "Batch",
			actions: submitted,
			completion,
			observability,
			operation,
			parentSpan,
			stopOnFirstFailure: request.stopOnFirstFailure === true,
		};

		// Submission is uninterruptible, so an interrupt can never land
		// between joining the waiting list and installing the withdrawal.
		return yield* Effect.uninterruptibleMask((restore) =>
			SynchronizedRef.modifyEffect(this.state, (state) => {
				if (state.lifecycle !== "running") {
					return Effect.fail(
						this.shutdownError("dispatch", submitted, operation),
					);
				}

				return this.enqueueOrWait(queue, state, batch);
			}).pipe(
				Effect.tap((queued) =>
					Effect.sync(() =>
						this.onSubmitted?.(queued ? "queued" : "waiting"),
					),
				),
				Effect.flatMap((queued) => {
					const result = restore(Deferred.await(completion));
					return queued
						? result
						: result.pipe(
								Effect.onInterrupt(() => this.withdraw(batch)),
							);
				}),
			),
		);
	});

	/**
	 * Refuses the batch, for a `VamProtectedPathError`, when any submitted
	 * action names a protected path. Prerequisites added in planning only
	 * create parent folders of submitted targets, so checking the submission
	 * suffices.
	 */
	private refuseProtected(
		actions: readonly VaultAction[],
		operation: VamOperation,
	): Effect.Effect<void, VamDispatchFailure> {
		const violation = this.protectedPaths?.findViolation(actions);
		if (!violation) return Effect.void;
		const error = new VamProtectedPathError({
			action: violation.action,
			operation: violation.action.kind,
			path: violation.path,
			prefix: violation.prefix,
			relation: violation.relation,
		});
		return Effect.logError("[DispatchBatch] Refused a protected path", {
			error: error.message,
		}).pipe(
			Effect.andThen(
				Effect.fail(
					VamDispatchFailure.notRun(error, actions, operation),
				),
			),
		);
	}

	whenIdleEffect(): Effect.Effect<void> {
		return SynchronizedRef.get(this.state).pipe(
			Effect.flatMap((state) =>
				state.busy ? Deferred.await(state.idle) : Effect.void,
			),
		);
	}

	readonly shutdownEffect = Effect.fn("DispatchBatch.shutdown")(function* (
		this: DispatchBatchWorker,
	): Effect.fn.Return<void, VamShutdownError> {
		const queue = yield* Deferred.await(this.queueReady);
		const waitForWorker = yield* SynchronizedRef.modifyEffect(
			this.state,
			(state) => {
				if (state.lifecycle !== "running") {
					return Effect.succeed([
						Deferred.await(this.workerDone),
						state,
					] as const);
				}

				return this.beginShutdown(this, queue, state);
			},
		);

		return yield* waitForWorker;
	});

	/**
	 * Queues the batch when it can keep FIFO order and there is space;
	 * otherwise appends it to the waiting list, unless the pending ceiling is
	 * reached. Runs under the state lock.
	 */
	private enqueueOrWait(
		queue: Queue.Queue<DispatchMessage>,
		state: CoordinationState,
		batch: BatchMessage,
	): Effect.Effect<
		readonly [queued: boolean, state: CoordinationState],
		VamDispatchFailure
	> {
		const busy: CoordinationState = state.busy
			? state
			: { ...state, busy: true, idle: Deferred.makeUnsafe<void>() };
		return Queue.size(queue).pipe(
			Effect.flatMap(
				(
					size,
				): Effect.Effect<
					readonly [boolean, CoordinationState],
					VamDispatchFailure
				> => {
					if (
						state.waiting.length === 0 &&
						size < this.queueCapacity
					) {
						return this.offerBatch(queue, batch).pipe(
							Effect.as([true, busy] as const),
						);
					}
					if (
						size + state.waiting.length >=
						MAX_PENDING_DISPATCH_BATCHES
					) {
						return Effect.fail(this.overflowError(batch));
					}
					return Effect.succeed([
						false,
						{ ...busy, waiting: [...state.waiting, batch] },
					] as const);
				},
			),
		);
	}

	private offerBatch(
		queue: Queue.Queue<DispatchMessage>,
		batch: BatchMessage,
	): Effect.Effect<void, VamDispatchFailure> {
		return Queue.offer(queue, batch).pipe(
			Effect.flatMap((offered) =>
				offered
					? Effect.void
					: Effect.fail(
							this.shutdownError(
								"dispatch.offer",
								batch.actions,
								batch.operation,
							),
						),
			),
		);
	}

	/** Moves waiting batches into free queue slots, oldest first. */
	private admitWaiting(
		queue: Queue.Queue<DispatchMessage>,
		state: CoordinationState,
	): Effect.Effect<CoordinationState> {
		if (state.waiting.length === 0) return Effect.succeed(state);
		return Queue.size(queue).pipe(
			Effect.flatMap((size) => {
				const admitted = state.waiting.slice(
					0,
					Math.max(0, this.queueCapacity - size),
				);
				return Effect.forEach(admitted, (batch) =>
					this.offerBatch(queue, batch).pipe(
						Effect.catch((error) =>
							Deferred.fail(batch.completion, error),
						),
					),
				).pipe(
					Effect.as({
						...state,
						waiting: state.waiting.slice(admitted.length),
					}),
				);
			}),
		);
	}

	private withdraw(batch: BatchMessage): Effect.Effect<void> {
		return SynchronizedRef.update(this.state, (state) =>
			state.waiting.includes(batch)
				? {
						...state,
						waiting: state.waiting.filter(
							(waiting) => waiting !== batch,
						),
					}
				: state,
		);
	}

	private completeBatch(
		batch: BatchMessage,
	): Effect.Effect<void, never, VamLiveServices> {
		// Writes deep in the file helpers record their Self Events under it.
		const run = () =>
			this.executeBatch(batch).pipe(
				Effect.provideService(CurrentVamOperation, batch.operation),
			);
		const execution = Option.match(batch.parentSpan, {
			onNone: run,
			onSome: (span) => Effect.withParentSpan(run(), span),
		}).pipe(Effect.provideContext(batch.observability));
		return Effect.exit(execution).pipe(
			Effect.flatMap((exit) => Deferred.done(batch.completion, exit)),
			Effect.onInterrupt(() =>
				Deferred.fail(batch.completion, this.interruptedFailure(batch)),
			),
			Effect.asVoid,
		);
	}

	private executeBatch(
		batch: BatchMessage,
	): Effect.Effect<VamDispatchReport, VamDispatchFailure, VamLiveServices> {
		const { actions, operation } = batch;
		if (actions.length === 0)
			return Effect.succeed(
				new VamDispatchReport({ ...operation, entries: [] }),
			);

		return this.runBatch(batch);
	}

	/**
	 * Plans and runs a non-empty batch under its own span, which the Self
	 * Events and link rewrites of its actions record as their cause.
	 */
	private readonly runBatch = Effect.fn("DispatchBatch.executeBatch")(
		function* (
			this: DispatchBatchWorker,
			batch: BatchMessage,
		): Effect.fn.Return<
			VamDispatchReport,
			VamDispatchFailure,
			VamLiveServices
		> {
			const { actions, operation, stopOnFirstFailure } = batch;
			yield* Effect.annotateCurrentSpan(operationAttributes(operation));
			const span = Option.getOrUndefined(
				yield* Effect.option(Effect.currentSpan),
			);
			const planned = yield* this.plan(actions).pipe(
				Effect.mapError((error) =>
					VamDispatchFailure.notRun(error, actions, operation),
				),
			);

			const entries: VamDispatchEntry[] = [];
			for (const [index, action] of planned.entries()) {
				const entry = yield* this.runAction(action, operation).pipe(
					Effect.provideService(CurrentDispatchSpan, span),
				);
				entries.push(entry);
				if (stopOnFirstFailure && entry.status !== "Done") {
					for (const skipped of planned.slice(index + 1))
						entries.push({ action: skipped, status: "Skipped" });
					break;
				}
			}

			const report = new VamDispatchReport({ ...operation, entries });
			const failure = VamDispatchFailure.ofReport(report);
			if (failure) return yield* Effect.fail(failure);
			return report;
		},
	);

	private readonly plan = Effect.fn("DispatchBatch.plan")(function* (
		this: DispatchBatchWorker,
		actions: readonly VaultAction[],
	) {
		const self = this;
		const representative = actions[0];
		const representativePath = representative
			? self.describePath(representative)
			: undefined;
		const program = Effect.gen(function* () {
			const withRequirements = yield* self.ensureRequirements(actions);
			const collapsed = yield* collapseActions(withRequirements);
			const graph = buildDependencyGraph(collapsed);
			return topologicalSort(collapsed, graph);
		}).pipe(
			Effect.mapError(
				(cause) =>
					new VamPlanningError({
						action: representative,
						// What the transform threw, as it is.
						cause:
							cause instanceof CollapseTransformError
								? cause.cause
								: cause,
						operation: "planDispatchBatch",
						path:
							cause instanceof VamVaultIoError
								? (cause.path ?? representativePath)
								: representativePath,
					}),
			),
			Effect.catchDefect((cause) =>
				Effect.fail(
					new VamPlanningError({
						action: representative,
						cause,
						operation: "planDispatchBatch",
						path: representativePath,
					}),
				),
			),
			Effect.tapError((failure) =>
				Effect.logError("[DispatchBatch] Planning failed", {
					error: self.causeMessage(
						self.unwrapTaggedCause(failure.cause),
					),
				}),
			),
			Effect.withSpan("vam.dispatch.plan", {
				attributes: {
					...self.spanAttributes(representative),
					"action.count": actions.length,
				},
			}),
		);

		return yield* program;
	});

	private readonly ensureRequirements = Effect.fn(
		"DispatchBatch.ensureRequirements",
	)(function* (this: DispatchBatchWorker, actions: readonly VaultAction[]) {
		const executable: VaultAction[] = [];
		for (const action of actions) {
			switch (action.kind) {
				case VaultActionKind.TrashFolder:
				case VaultActionKind.TrashFile:
				case VaultActionKind.TrashMdFile:
					if (yield* this.exists(action.payload.splitPath)) {
						executable.push(action);
					}
					break;
				default:
					executable.push(action);
			}
		}

		const destinations = getDestinationsToCheck(
			executable,
			(path) => this.toFolder(path),
			(key) => this.toMdFile(key),
		);
		const requiredActions = yield* ensureDestinationsExist(
			destinations,
			(splitPath) => this.exists(splitPath),
			(path) => this.toFolder(path),
			(key) => this.toMdFile(key),
			executable,
		);

		return [...executable, ...requiredActions];
	});

	private readonly exists = Effect.fn("vam.dispatch.exists")(function* (
		splitPath: AnySplitPath,
	) {
		const path = splitPathCodec.format(splitPath);
		yield* Effect.annotateCurrentSpan({ path });
		const vault = yield* VaultIo;
		const entry = yield* vault.getAbstractFileByPath(path);
		return splitPath.kind === "Folder"
			? entry instanceof TFolder
			: entry instanceof TFile;
	});

	/**
	 * Opens the action's Self Event window immediately before executing it and
	 * starts its TTL when the action ends, however it ends. Each action's
	 * window is thereby measured from its own execution, not from the start of
	 * the batch. Opening is uninterruptible and closing always runs, so an
	 * interrupted action cannot leave entries that never expire.
	 *
	 * Opening the window cannot fail, so every planned action that runs gets
	 * exactly one report entry, from its own execution.
	 *
	 * A create or a rename records what its own collision check found at
	 * its target, immediately before it wrote or moved, so an `Uncertain`
	 * entry says whether the target was taken as the action ran, not when
	 * the batch was submitted (#202).
	 */
	private runAction(
		action: VaultAction,
		operation: VamOperation,
	): Effect.Effect<VamDispatchEntry, never, VamLiveServices> {
		return Effect.acquireUseRelease(
			this.selfEventTracker.beginEffect(action, operation),
			() => {
				const check: TargetCheck = { taken: undefined };
				return this.executeAction(action, operation).pipe(
					Effect.provideService(CurrentTargetCheck, check),
					Effect.map((entry) =>
						VamDispatchReport.withTargetTaken(entry, check.taken),
					),
				);
			},
			(_, exit) =>
				this.selfEventTracker.finishEffect(
					action,
					Exit.isSuccess(exit) && exit.value.status === "Done",
				),
		);
	}

	private executeAction(
		action: VaultAction,
		operation: VamOperation,
	): Effect.Effect<VamDispatchEntry, never, VamLiveServices> {
		const run = this.executor.execute(action);
		const { linkUpdates } = this;
		const rename = linkUpdates && linkUpdatingRename(action);
		const tracked = rename
			? linkUpdates.aroundRename(rename, operation, run)
			: run;
		const execute = tracked.pipe(
			Effect.matchCauseEffect({
				onFailure: (cause) => {
					const error = actionFailure(action, cause);
					const entry = VamDispatchReport.entryFor(error);
					return this.logActionFailure(entry, error, cause).pipe(
						Effect.as(entry),
					);
				},
				onSuccess: (outcome) =>
					Effect.succeed<VamDispatchEntry>({
						action,
						outcome,
						status: "Done",
					}),
			}),
			Effect.withSpan("vam.dispatch.action", {
				attributes: this.spanAttributes(action),
			}),
		);

		return execute;
	}

	/**
	 * Logs a failed action. A defect's or an interrupt's whole `Cause` goes
	 * with the entry, so the log keeps every reason.
	 */
	private logActionFailure(
		entry: VamDispatchEntry,
		error: VamDispatchError,
		cause: Cause.Cause<VamDispatchError>,
	): Effect.Effect<void> {
		const { action } = error;
		const details = {
			error: Cause.isCause(error.cause)
				? formatCause(error.cause, { stack: false })
				: this.causeMessage(this.unwrapTaggedCause(error.cause)),
			kind: action.kind,
			path: this.describePath(action),
			status: entry.status,
		};
		switch (error.kind) {
			case "defect":
				return Effect.logError(
					"[DispatchBatch] Action threw exception",
					details,
					cause,
				);
			case "interrupted":
				return Effect.logError(
					"[DispatchBatch] Action was interrupted",
					details,
					cause,
				);
			default:
				return Effect.logError(
					"[DispatchBatch] Action failed",
					details,
				);
		}
	}

	private nextDecision(
		queue: Queue.Queue<DispatchMessage>,
	): Effect.Effect<WorkerDecision> {
		return SynchronizedRef.modifyEffect(this.state, (state) => {
			if (state.lifecycle !== "running") {
				return Effect.succeed([
					{ _tag: "Shutdown" } as const,
					state,
				] as const);
			}

			return this.admitWaiting(queue, state).pipe(
				Effect.flatMap((admitted) =>
					Queue.size(queue).pipe(
						Effect.flatMap((size) =>
							size > 0
								? Effect.succeed([
										{ _tag: "Continue" } as const,
										admitted,
									] as const)
								: this.markIdle(admitted),
						),
					),
				),
			);
		});
	}

	private markIdle(
		state: CoordinationState,
	): Effect.Effect<readonly [WorkerDecision, CoordinationState]> {
		return Deferred.succeed(state.idle, undefined).pipe(
			Effect.as([
				{ _tag: "Wait" } as const,
				{ ...state, busy: false },
			] as const),
		);
	}

	private finishWorker(): Effect.Effect<void> {
		return SynchronizedRef.modifyEffect(this.state, (state) =>
			Deferred.succeed(state.idle, undefined).pipe(
				Effect.flatMap(() =>
					Deferred.succeed(this.workerDone, undefined),
				),
				Effect.as([
					undefined,
					{
						...state,
						busy: false,
						lifecycle: "shutdown" as const,
					},
				] as const),
			),
		);
	}

	/**
	 * After the worker ended without a shutdown: under the state lock,
	 * refuses new submissions, fails what is queued or waiting, and
	 * releases idle and shutdown waiters.
	 */
	private abandon(): Effect.Effect<void> {
		return SynchronizedRef.modifyEffect(this.state, (state) =>
			Effect.gen({ self: this }, function* () {
				const ready = yield* Deferred.poll(this.queueReady);
				const queued = Option.isSome(ready)
					? yield* Queue.clear(yield* ready.value)
					: [];
				for (const message of [...queued, ...state.waiting]) {
					if (message._tag !== "Batch") continue;
					yield* Deferred.fail(
						message.completion,
						this.shutdownError(
							"dispatch.queued",
							message.actions,
							message.operation,
						),
					);
				}
				yield* Deferred.succeed(state.idle, undefined);
				yield* Deferred.succeed(this.workerDone, undefined);
				return [
					undefined,
					{
						...state,
						busy: false,
						lifecycle: "shutdown" as const,
						waiting: [],
					},
				] as const;
			}),
		);
	}

	/**
	 * A batch interrupted while it ran: any of its actions may have
	 * written, so each is `Uncertain`, not `Skipped`.
	 */
	private interruptedFailure(batch: BatchMessage): VamDispatchFailure {
		const reason = new VamShutdownError({
			cause: new Error(
				"Vault Action Manager dispatch was interrupted while the batch ran",
			),
			operation: "dispatch.interrupted",
		});
		return new VamDispatchFailure({
			reason,
			report: new VamDispatchReport({
				...batch.operation,
				entries: batch.actions.map((action) => ({
					action,
					error: new VamDispatchError({
						action,
						cause: reason,
						kind: "interrupted",
						operation: "dispatch.interrupted",
					}),
					status: "Uncertain" as const,
				})),
			}),
		});
	}

	private overflowError(batch: BatchMessage): VamDispatchFailure {
		return VamDispatchFailure.notRun(
			new VamDispatchOverflowError({
				action: batch.actions[0],
				cause: new Error(
					`Dispatch Batch queue reached its ceiling of ${MAX_PENDING_DISPATCH_BATCHES} pending batches; the batch was not submitted`,
				),
				limit: MAX_PENDING_DISPATCH_BATCHES,
				operation: "dispatch.overflow",
			}),
			batch.actions,
			batch.operation,
		);
	}

	private shutdownError(
		operation: string,
		actions: readonly VaultAction[],
		batch: VamOperation,
	): VamDispatchFailure {
		return VamDispatchFailure.notRun(
			new VamShutdownError({
				cause: new Error(
					"Vault Action Manager dispatch has been shut down",
				),
				operation,
			}),
			actions,
			batch,
		);
	}

	private toFolder(path: string): SplitPathToFolder | null {
		const parsed = splitPathCodec.parse(path);
		return parsed.kind === "Folder" ? parsed : null;
	}

	private toMdFile(path: string): SplitPathToMdFile | null {
		const parsed = splitPathCodec.parse(path);
		return parsed.kind === "MdFile" ? parsed : null;
	}

	private describePath(action: VaultAction): string {
		switch (action.kind) {
			case VaultActionKind.RenameFile:
			case VaultActionKind.RenameMdFile:
			case VaultActionKind.RenameFolder:
				return `${splitPathCodec.format(action.payload.from)} → ${splitPathCodec.format(action.payload.to)}`;
			default:
				return splitPathCodec.format(action.payload.splitPath);
		}
	}

	private spanAttributes(
		action: VaultAction | undefined,
	): Tracer.SpanOptions["attributes"] {
		if (!action) return {};
		return {
			"action.kind": action.kind,
			"action.path": this.describePath(action),
		};
	}

	private causeMessage(cause: unknown): string {
		return cause instanceof Error ? cause.message : String(cause);
	}

	private unwrapTaggedCause(cause: unknown): unknown {
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
}

/** The span attributes that line a batch's spans up with its events. */
function operationAttributes(operation: VamOperation): Record<string, string> {
	return {
		"vam.caller": operation.caller,
		"vam.operationId": operation.operationId,
	};
}

/**
 * The error of an action whose execution failed with `cause`: its own
 * `VamDispatchError` when that is the cause's one reason. Anything else is
 * kept whole (`causeValue`): `interrupted` when the cause holds only
 * interrupts, otherwise `defect`, such as a throw, or a failure with a
 * finalizer's defect beside it.
 */
function actionFailure(
	action: VaultAction,
	cause: Cause.Cause<VamDispatchError>,
): VamDispatchError {
	const error = causeValue(cause);
	if (error instanceof VamDispatchError) return error;
	return new VamDispatchError({
		action,
		cause: error,
		kind: Cause.hasInterruptsOnly(cause) ? "interrupted" : "defect",
		operation: `execute.${action.kind}`,
	});
}
