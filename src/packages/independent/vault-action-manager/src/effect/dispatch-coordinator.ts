import {
	Cause,
	Deferred,
	Effect,
	Fiber,
	Option,
	Queue,
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
	VamPlanningError,
	VamShutdownError,
	VamVaultIoError,
} from "./errors";
import { type VamLiveServices, VaultIo } from "./ports";
import type { VamRuntime } from "./runtime";

export type DispatchEffectFailure =
	| VamPlanningError
	| VamShutdownError
	| readonly VamDispatchError[];

type DispatchBatchWorkerOptions = {
	readonly maxBatches?: number;
};

type BatchMessage = {
	readonly _tag: "Batch";
	readonly actions: readonly VaultAction[];
	readonly completion: Deferred.Deferred<void, DispatchEffectFailure>;
	readonly parentSpan: Option.Option<Tracer.Span>;
};

type ShutdownMessage = { readonly _tag: "Shutdown" };
type DispatchMessage = BatchMessage | ShutdownMessage;

type Lifecycle = "running" | "shuttingDown" | "shutdown";

type CoordinationState = {
	readonly busy: boolean;
	readonly idle: Deferred.Deferred<void>;
	readonly lifecycle: Lifecycle;
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
	private readonly maxBatches: number;
	private readonly queueReady =
		Deferred.makeUnsafe<Queue.Queue<DispatchMessage>>();
	private readonly state = SynchronizedRef.makeUnsafe<CoordinationState>({
		busy: false,
		idle: this.idleSeed,
		lifecycle: "running",
	});
	private readonly workerDone = Deferred.makeUnsafe<void>();

	private readonly worker = Effect.fn("DispatchBatch.worker")(function* (
		self: DispatchBatchWorker,
	) {
		const queue = yield* Queue.unbounded<DispatchMessage>();
		yield* Deferred.succeed(self.queueReady, queue);

		let processedInCycle = 0;
		while (true) {
			const message = yield* Queue.take(queue);
			if (message._tag === "Shutdown") break;

			if (processedInCycle >= self.maxBatches) {
				const shouldShutdown = yield* self.overflowCycle(
					queue,
					message,
				);
				if (shouldShutdown) {
					yield* self.finishWorker();
					return;
				}
				processedInCycle = 0;
				continue;
			}

			yield* self.completeBatch(message);
			processedInCycle++;

			const decision = yield* self.nextDecision(queue, processedInCycle);
			switch (decision._tag) {
				case "Continue":
					break;
				case "Shutdown":
					yield* self.finishWorker();
					return;
				case "Wait":
					processedInCycle = 0;
					break;
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
			for (const message of queued) {
				if (message._tag !== "Batch") continue;
				yield* Deferred.fail(
					message.completion,
					self.shutdownError("dispatch.queued", message.actions[0]),
				);
			}

			const nextState: CoordinationState = state.busy
				? { ...state, lifecycle: "shuttingDown" }
				: {
						...state,
						busy: true,
						idle: Deferred.makeUnsafe<void>(),
						lifecycle: "shuttingDown",
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
		this.maxBatches = options.maxBatches ?? 10;
		const scopedWorker = Effect.scoped(
			Effect.forkScoped(this.worker(this)).pipe(
				Effect.flatMap(Fiber.join),
			),
		);
		void this.runtime.runPromiseExit(scopedWorker);
	}

	dispatchEffect(
		actions: readonly VaultAction[],
	): Effect.Effect<void, DispatchEffectFailure> {
		const submitted = [...actions];
		const representative = submitted[0];

		return Effect.fn("DispatchBatch.dispatch")(function* (
			self: DispatchBatchWorker,
		) {
			const queue = yield* Deferred.await(self.queueReady);
			const parentSpan = yield* Effect.option(Effect.currentSpan);
			const completion = yield* Deferred.make<
				void,
				DispatchEffectFailure
			>();
			const batch: BatchMessage = {
				_tag: "Batch",
				actions: submitted,
				completion,
				parentSpan,
			};

			yield* SynchronizedRef.modifyEffect(self.state, (state) => {
				if (state.lifecycle !== "running") {
					return Effect.fail(
						self.shutdownError("dispatch", representative),
					);
				}

				const nextState = state.busy
					? state
					: {
							...state,
							busy: true,
							idle: Deferred.makeUnsafe<void>(),
						};
				return Queue.offer(queue, batch).pipe(
					Effect.flatMap((offered) =>
						offered
							? Effect.succeed([undefined, nextState] as const)
							: Effect.fail(
									self.shutdownError(
										"dispatch.offer",
										representative,
									),
								),
					),
				);
			});

			return yield* Deferred.await(completion);
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

	private completeBatch(
		batch: BatchMessage,
	): Effect.Effect<void, never, VamLiveServices> {
		const execution = Option.match(batch.parentSpan, {
			onNone: () => this.executeBatch(batch.actions),
			onSome: (span) =>
				Effect.withParentSpan(this.executeBatch(batch.actions), span),
		});
		return Effect.exit(execution).pipe(
			Effect.flatMap((exit) => Deferred.done(batch.completion, exit)),
			Effect.asVoid,
		);
	}

	private executeBatch(
		actions: readonly VaultAction[],
	): Effect.Effect<void, DispatchEffectFailure, VamLiveServices> {
		if (actions.length === 0) return Effect.void;

		const representative = actions[0];

		return Effect.fn("DispatchBatch.executeBatch")(function* (
			self: DispatchBatchWorker,
		) {
			const planned = yield* self.plan(actions);
			yield* self.selfEventTracker.registerEffect(planned).pipe(
				Effect.mapError(
					(cause) =>
						[
							new VamDispatchError({
								action: planned[0] ?? representative,
								cause,
								operation: "registerSelfEvents",
							}),
						] as const,
				),
			);

			const errors: VamDispatchError[] = [];
			for (const action of planned) {
				const failure = yield* self.executeAction(action);
				if (failure) errors.push(failure);
			}

			if (errors.length > 0) return yield* Effect.fail(errors);
		})(this);
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
		processedInCycle: number,
	): Effect.Effect<WorkerDecision> {
		return SynchronizedRef.modifyEffect(this.state, (state) => {
			if (state.lifecycle !== "running") {
				return Effect.succeed([
					{ _tag: "Shutdown" } as const,
					state,
				] as const);
			}

			if (processedInCycle >= this.maxBatches) {
				return Queue.clear(queue).pipe(
					Effect.flatMap((messages) =>
						this.completeOverflowed(messages).pipe(
							Effect.flatMap(() => this.markIdle(state)),
						),
					),
				);
			}

			return Queue.size(queue).pipe(
				Effect.flatMap((size) =>
					size > 0
						? Effect.succeed([
								{ _tag: "Continue" } as const,
								state,
							] as const)
						: this.markIdle(state),
				),
			);
		});
	}

	private overflowCycle(
		queue: Queue.Queue<DispatchMessage>,
		first: BatchMessage,
	): Effect.Effect<boolean> {
		return SynchronizedRef.modifyEffect(this.state, (state) => {
			if (state.lifecycle !== "running") {
				return this.completeOverflowed([first]).pipe(
					Effect.as([true, state] as const),
				);
			}

			return Queue.clear(queue).pipe(
				Effect.flatMap((queued) =>
					this.completeOverflowed([first, ...queued]).pipe(
						Effect.flatMap(() => this.markIdle(state)),
					),
				),
				Effect.map(([, nextState]) => [false, nextState] as const),
			);
		});
	}

	private completeOverflowed(
		messages: readonly DispatchMessage[],
	): Effect.Effect<void> {
		const batches = messages.filter(
			(message): message is BatchMessage => message._tag === "Batch",
		);
		const droppedActionCount = batches.reduce(
			(count, batch) => count + batch.actions.length,
			0,
		);
		const logOverflow =
			batches.length === 0
				? Effect.void
				: Effect.logWarning(
						`[DispatchBatch] Batch limit (${this.maxBatches}) reached, dropping ${droppedActionCount} queued actions from ${batches.length} submitted batches`,
					);
		return logOverflow.pipe(
			Effect.flatMap(() =>
				Effect.forEach(batches, (batch) => {
					const cause = `Dispatch Batch overflow: batch limit ${this.maxBatches} reached, ${batch.actions.length} actions dropped`;
					return Deferred.fail(batch.completion, [
						new VamDispatchError({
							action: batch.actions[0],
							cause,
							operation: "overflow",
						}),
					]);
				}),
			),
			Effect.asVoid,
		);
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
