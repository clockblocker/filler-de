import {
	Cause,
	Deferred,
	Effect,
	Fiber,
	Option,
	Queue,
	Result,
	SynchronizedRef,
	type Tracer,
} from "effect";
import { TFile, TFolder } from "obsidian";
import { collapseActions } from "../impl/actions-processing/collapse";
import { buildDependencyGraph } from "../impl/actions-processing/dependency-detector";
import {
	ensureDestinationsExist,
	getDestinationsToCheck,
} from "../impl/actions-processing/ensure-requirements-helpers";
import type { Executor } from "../impl/actions-processing/executor";
import { topologicalSort } from "../impl/actions-processing/topological-sort";
import type { SelfEventTracker } from "../impl/event-processing/self-event-tracker";
import { splitPathCodec } from "../split-path-codec";
import type {
	AnySplitPath,
	SplitPathToFolder,
	SplitPathToMdFile,
} from "../types/split-path";
import type { VaultAction } from "../types/vault-action";
import { VaultActionKind } from "../types/vault-action";
import {
	VamDispatchError,
	VamDispatchOverflowError,
	VamDispatchStoppedError,
	VamPlanningError,
	VamShutdownError,
	VamVaultIoError,
} from "./errors";
import { type VamLiveServices, VaultIo } from "./ports";
import type { VamRuntime } from "./runtime";

/** Failure of a default batch, which attempts every planned action. */
export type DispatchEffectFailure =
	| VamPlanningError
	| VamShutdownError
	| VamDispatchOverflowError
	| readonly VamDispatchError[];

/** Failure of a batch dispatched with `stopOnFirstFailure: true`. */
export type StopOnFirstFailureDispatchFailure =
	| VamPlanningError
	| VamShutdownError
	| VamDispatchOverflowError
	| VamDispatchStoppedError;

export type AnyDispatchEffectFailure =
	| DispatchEffectFailure
	| StopOnFirstFailureDispatchFailure;

/** Per-batch dispatch options. */
export type DispatchOptions = {
	/**
	 * Stop at the first failed action instead of attempting the rest of the
	 * batch. The batch then fails with a `VamDispatchStoppedError` listing the
	 * planned actions already executed and the ones skipped. Defaults to
	 * `false`.
	 */
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
	readonly completion: Deferred.Deferred<void, AnyDispatchEffectFailure>;
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
 * This class never creates or runs its own runtime. Its worker and all public
 * programs are attached to the runtime supplied by the VAM composition root.
 */
export class DispatchBatchWorker {
	private readonly idleSeed = Deferred.makeUnsafe<void>();
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

	private readonly worker = Effect.fn("DispatchBatch.worker")(function* (
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
					self.shutdownError("dispatch.queued", message.actions[0]),
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
		private readonly runtime: VamRuntime,
		private readonly executor: Executor,
		private readonly selfEventTracker: SelfEventTracker,
		options: DispatchBatchWorkerOptions = {},
	) {
		this.queueCapacity = Math.min(
			MAX_PENDING_DISPATCH_BATCHES,
			Math.max(1, options.queueCapacity ?? DEFAULT_QUEUE_CAPACITY),
		);
		this.onSubmitted = options.onSubmitted;
		const scopedWorker = Effect.scoped(
			Effect.forkScoped(this.worker(this)).pipe(
				Effect.flatMap(Fiber.join),
			),
		);
		void this.runtime.runPromiseExit(scopedWorker);
	}

	/**
	 * Submits one Dispatch Batch and waits for its result.
	 *
	 * When the queue is full, the batch waits for space behind earlier waiting
	 * batches instead of being dropped. Interrupting a caller whose batch is
	 * still waiting withdraws the batch; once queued, it runs to completion.
	 */
	dispatchEffect(
		actions: readonly VaultAction[],
		options: DispatchOptions = {},
	): Effect.Effect<void, AnyDispatchEffectFailure> {
		const submitted = [...actions];
		const representative = submitted[0];

		return Effect.fn("DispatchBatch.dispatch")(function* (
			self: DispatchBatchWorker,
		) {
			const queue = yield* Deferred.await(self.queueReady);
			const parentSpan = yield* Effect.option(Effect.currentSpan);
			const completion = yield* Deferred.make<
				void,
				AnyDispatchEffectFailure
			>();
			const batch: BatchMessage = {
				_tag: "Batch",
				actions: submitted,
				completion,
				parentSpan,
				stopOnFirstFailure: options.stopOnFirstFailure === true,
			};

			// Submission is uninterruptible, so an interrupt can never land
			// between joining the waiting list and installing the withdrawal.
			return yield* Effect.uninterruptibleMask((restore) =>
				SynchronizedRef.modifyEffect(self.state, (state) => {
					if (state.lifecycle !== "running") {
						return Effect.fail(
							self.shutdownError("dispatch", representative),
						);
					}

					return self.enqueueOrWait(queue, state, batch);
				}).pipe(
					Effect.tap((queued) =>
						Effect.sync(() =>
							self.onSubmitted?.(queued ? "queued" : "waiting"),
						),
					),
					Effect.flatMap((queued) => {
						const result = restore(Deferred.await(completion));
						return queued
							? result
							: result.pipe(
									Effect.onInterrupt(() =>
										self.withdraw(batch),
									),
								);
					}),
				),
			);
		})(this);
	}

	whenIdleEffect(): Effect.Effect<void> {
		return SynchronizedRef.get(this.state).pipe(
			Effect.flatMap((state) =>
				state.busy ? Deferred.await(state.idle) : Effect.void,
			),
		);
	}

	shutdownEffect(): Effect.Effect<void, VamShutdownError> {
		return Effect.fn("DispatchBatch.shutdown")(function* (
			self: DispatchBatchWorker,
		) {
			const queue = yield* Deferred.await(self.queueReady);
			const waitForWorker = yield* SynchronizedRef.modifyEffect(
				self.state,
				(state) => {
					if (state.lifecycle !== "running") {
						return Effect.succeed([
							Deferred.await(self.workerDone),
							state,
						] as const);
					}

					return self.beginShutdown(self, queue, state);
				},
			);

			return yield* waitForWorker;
		})(this);
	}

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
		VamShutdownError | VamDispatchOverflowError
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
					VamShutdownError | VamDispatchOverflowError
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
	): Effect.Effect<void, VamShutdownError> {
		return Queue.offer(queue, batch).pipe(
			Effect.flatMap((offered) =>
				offered
					? Effect.void
					: Effect.fail(
							this.shutdownError(
								"dispatch.offer",
								batch.actions[0],
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
		const run = () =>
			this.executeBatch(batch.actions, batch.stopOnFirstFailure);
		const execution = Option.match(batch.parentSpan, {
			onNone: run,
			onSome: (span) => Effect.withParentSpan(run(), span),
		});
		return Effect.exit(execution).pipe(
			Effect.flatMap((exit) => Deferred.done(batch.completion, exit)),
			Effect.asVoid,
		);
	}

	private executeBatch(
		actions: readonly VaultAction[],
		stopOnFirstFailure: boolean,
	): Effect.Effect<void, AnyDispatchEffectFailure, VamLiveServices> {
		if (actions.length === 0) return Effect.void;

		return Effect.fn("DispatchBatch.executeBatch")(function* (
			self: DispatchBatchWorker,
		) {
			const planned = yield* self.plan(actions);

			const errors: VamDispatchError[] = [];
			for (const [index, action] of planned.entries()) {
				const failure = yield* self.runAction(action);
				if (!failure) continue;
				if (stopOnFirstFailure) {
					return yield* Effect.fail(
						self.stopped(
							failure,
							planned.slice(0, index),
							planned.slice(index + 1),
						),
					);
				}
				errors.push(failure);
			}

			if (errors.length > 0) return yield* Effect.fail(errors);
		})(this);
	}

	private stopped(
		failure: VamDispatchError,
		executed: readonly VaultAction[],
		skipped: readonly VaultAction[],
	): VamDispatchStoppedError {
		return new VamDispatchStoppedError({
			action: failure.action,
			cause: failure.cause,
			executed,
			failure,
			operation: "dispatch.stopOnFirstFailure",
			skipped,
		});
	}

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
						cause,
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
	 * the batch. An action whose window cannot be opened is not executed.
	 */
	private readonly runAction = Effect.fnUntraced(function* (
		this: DispatchBatchWorker,
		action: VaultAction,
	): Effect.fn.Return<VamDispatchError | undefined, never, VamLiveServices> {
		const registration = yield* Effect.result(
			this.selfEventTracker.beginEffect(action),
		);
		if (Result.isFailure(registration)) {
			return new VamDispatchError({
				action,
				cause: registration.failure,
				operation: "registerSelfEvents",
			});
		}

		return yield* this.executeAction(action).pipe(
			Effect.ensuring(this.selfEventTracker.finishEffect(action)),
		);
	});

	private executeAction(
		action: VaultAction,
	): Effect.Effect<VamDispatchError | undefined, never, VamLiveServices> {
		const execute = this.executor.execute(action).pipe(
			Effect.matchCause({
				onFailure: (cause) =>
					new VamDispatchError({
						action,
						cause: Cause.squash(cause),
						operation: "executeAction",
					}),
				onSuccess: () => undefined,
			}),
			Effect.tap((failure) =>
				failure
					? Effect.logError(
							failure.cause instanceof Error &&
								!(failure.cause instanceof VamDispatchError)
								? "[DispatchBatch] Action threw exception"
								: "[DispatchBatch] Action failed",
							{
								error: this.causeMessage(
									this.unwrapTaggedCause(failure.cause),
								),
								kind: action.kind,
								path: this.describePath(action),
							},
						)
					: Effect.void,
			),
			Effect.withSpan("vam.dispatch.action", {
				attributes: this.spanAttributes(action),
			}),
		);

		return execute;
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

	private overflowError(batch: BatchMessage): VamDispatchOverflowError {
		return new VamDispatchOverflowError({
			action: batch.actions[0],
			cause: new Error(
				`Dispatch Batch queue reached its ceiling of ${MAX_PENDING_DISPATCH_BATCHES} pending batches; the batch was not submitted`,
			),
			limit: MAX_PENDING_DISPATCH_BATCHES,
			operation: "dispatch.overflow",
		});
	}

	private shutdownError(
		operation: string,
		action?: VaultAction,
	): VamShutdownError {
		return new VamShutdownError({
			cause: new Error(
				"Vault Action Manager dispatch has been shut down",
				{ cause: action },
			),
			operation,
		});
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
