import {
	Cause,
	type Context,
	Deferred,
	Effect,
	Exit,
	PubSub,
	Queue,
	Ref,
	Scope,
	Semaphore,
} from "effect";
import type { App, EventRef, TAbstractFile } from "obsidian";
import { VamSubscriptionError } from "../../effect/errors";
import { logger } from "../../internal/logger";
import { type VaultEvent, VaultEventKind } from "../../types/vault-event";
import {
	type EventAccumulatorCommand,
	type EventAccumulatorOptions,
	runEventAccumulator,
} from "./bulk-event-emmiter/batteries/event-accumulator";
import { collapseVaultEvents } from "./bulk-event-emmiter/batteries/processing-chain/collapse";
import { reduceRoots } from "./bulk-event-emmiter/batteries/processing-chain/reduce-roots";
import type { BulkVaultEvent } from "./bulk-event-emmiter/types/bulk/bulk-vault-event";
import { isDelete, isRename } from "./bulk-event-emmiter/types/bulk/helpers";
import type { SelfEventTracker } from "./self-event-tracker";
import {
	makeVaultEventForFileCreated,
	makeVaultEventForFileDeleted,
	tryMakeVaultEventForFileRenamed,
} from "./vault-events-for-events";

type BulkVaultEventHandler = (event: BulkVaultEvent) => Promise<void>;

type SubscriberBarrier = {
	readonly completed: Deferred.Deferred<void>;
	readonly remaining: Ref.Ref<number>;
};

type PublishedMessage =
	| { readonly _tag: "Bulk"; readonly bulk: BulkVaultEvent }
	| { readonly _tag: "Barrier"; readonly barrier: SubscriberBarrier };

type SubscriberState = {
	readonly handler: BulkVaultEventHandler;
	readonly id: number;
	readonly pendingBarriers: Ref.Ref<ReadonlySet<SubscriberBarrier>>;
	readonly scope: Scope.Closeable;
};

type ObservationSession = {
	readonly closed: Deferred.Deferred<void>;
	readonly intake: Queue.Queue<EventAccumulatorCommand>;
	readonly scope: Scope.Closeable;
};

type ObservationCore = {
	readonly activeHandlerWork: Ref.Ref<number>;
	readonly context: Context.Context<never>;
	readonly listeningRequested: Ref.Ref<boolean>;
	readonly nextSubscriberId: Ref.Ref<number>;
	readonly pubsub: PubSub.PubSub<PublishedMessage>;
	readonly rootScope: Scope.Closeable;
	readonly session: Ref.Ref<ObservationSession | null>;
	readonly sessionLock: Semaphore.Semaphore;
	readonly subscribers: Ref.Ref<ReadonlyMap<number, SubscriberState>>;
};

export type VaultObservationOptions = Partial<EventAccumulatorOptions>;

export type VaultObservationSubscription = {
	readonly close: Effect.Effect<void>;
};

const makeObservationCore = Effect.fn("makeObservationCore")(
	function* (): Effect.fn.Return<ObservationCore> {
		const context = yield* Effect.context<never>();
		const rootScope = yield* Scope.make("sequential");
		const pubsub = yield* PubSub.unbounded<PublishedMessage>();
		yield* Scope.addFinalizer(rootScope, PubSub.shutdown(pubsub));
		return {
			activeHandlerWork: yield* Ref.make(0),
			context,
			listeningRequested: yield* Ref.make(false),
			nextSubscriberId: yield* Ref.make(0),
			pubsub,
			rootScope,
			session: yield* Ref.make<ObservationSession | null>(null),
			sessionLock: yield* Semaphore.make(1),
			subscribers: yield* Ref.make<ReadonlyMap<number, SubscriberState>>(
				new Map(),
			),
		};
	},
);

/**
 * Effect-native Vault observation. Construct it inside the VAM runtime with
 * `makeEffect` so callbacks and scoped fibers capture that runtime's context.
 */
export class VaultObservation {
	private readonly core: ObservationCore;
	private readonly options: EventAccumulatorOptions;

	private constructor(
		private readonly app: App,
		private readonly selfEvents: SelfEventTracker,
		options: VaultObservationOptions,
		core: ObservationCore,
	) {
		this.options = {
			maxWindowMs: options.maxWindowMs ?? 2000,
			quietWindowMs: options.quietWindowMs ?? 250,
		};
		this.core = core;
	}

	static readonly makeEffect = Effect.fn("VaultObservation.makeEffect")(
		function* (
			app: App,
			selfEvents: SelfEventTracker,
			options: VaultObservationOptions = {},
		): Effect.fn.Return<VaultObservation> {
			const core = yield* makeObservationCore();
			return new VaultObservation(app, selfEvents, options, core);
		},
	);

	readonly startEffect = Effect.fn("VaultObservation.start")(function* (
		this: VaultObservation,
	): Effect.fn.Return<void, VamSubscriptionError> {
		yield* Ref.set(this.core.listeningRequested, true);
		yield* this.ensureSessionEffect();
	});

	readonly subscribeEffect = Effect.fn("VaultObservation.subscribe")(
		function* (
			this: VaultObservation,
			handler: BulkVaultEventHandler,
		): Effect.fn.Return<
			VaultObservationSubscription,
			VamSubscriptionError
		> {
			const scope = yield* Scope.fork(this.core.rootScope, "sequential");
			const subscription = yield* PubSub.subscribe(this.core.pubsub).pipe(
				Effect.provideService(Scope.Scope, scope),
			);
			const pendingBarriers = yield* Ref.make<
				ReadonlySet<SubscriberBarrier>
			>(new Set());
			const id = yield* Ref.getAndUpdate(
				this.core.nextSubscriberId,
				(value) => value + 1,
			);
			const state: SubscriberState = {
				handler,
				id,
				pendingBarriers,
				scope,
			};

			yield* Scope.addFinalizer(
				scope,
				this.releasePendingBarriersEffect(state),
			);
			yield* Ref.update(this.core.subscribers, (subscribers) => {
				const next = new Map(subscribers);
				next.set(id, state);
				return next;
			});

			yield* this.subscriberLoopEffect(state, subscription).pipe(
				Effect.forkIn(scope),
			);
			yield* this.ensureSessionEffect().pipe(
				Effect.onError(() =>
					Ref.update(this.core.subscribers, (subscribers) => {
						const next = new Map(subscribers);
						next.delete(id);
						return next;
					}).pipe(Effect.andThen(Scope.close(scope, Exit.void))),
				),
			);

			return {
				close: this.closeSubscriptionEffect(id),
			};
		},
	);

	readonly flushPendingEffect = Effect.fn("VaultObservation.flushPending")(
		function* (this: VaultObservation): Effect.fn.Return<void> {
			const session = yield* Ref.get(this.core.session);
			if (!session) return;

			const completed = yield* Deferred.make<void>();
			const offered = yield* Queue.offer(session.intake, {
				_tag: "Flush",
				completed,
			});
			if (!offered) return;
			yield* Effect.raceFirst(
				Deferred.await(completed),
				Deferred.await(session.closed),
			);
		},
	);

	readonly whenIdleEffect = Effect.fn("VaultObservation.whenIdle")(function* (
		this: VaultObservation,
	): Effect.fn.Return<void> {
		const session = yield* Ref.get(this.core.session);
		if (!session) return;

		const completed = yield* Deferred.make<void>();
		const offered = yield* Queue.offer(session.intake, {
			_tag: "Settled",
			completed,
		});
		if (!offered) return;
		yield* Effect.raceFirst(
			Deferred.await(completed),
			Deferred.await(session.closed),
		);
	});

	readonly activeHandlerCountEffect = Effect.fn(
		"VaultObservation.activeHandlerCount",
	)(function* (this: VaultObservation): Effect.fn.Return<number> {
		return yield* Ref.get(this.core.activeHandlerWork);
	});

	readonly disposeEffect = Effect.fn("VaultObservation.dispose")(function* (
		this: VaultObservation,
	): Effect.fn.Return<void> {
		yield* Ref.set(this.core.subscribers, new Map());
		yield* Ref.set(this.core.session, null);
		yield* Scope.close(this.core.rootScope, Exit.void);
	});

	private readonly ensureSessionEffect = Effect.fn(
		"VaultObservation.ensureSession",
	)(function* (
		this: VaultObservation,
	): Effect.fn.Return<void, VamSubscriptionError> {
		yield* this.core.sessionLock.withPermits(1)(
			Effect.gen(
				function* (
					this: VaultObservation,
				): Effect.fn.Return<void, VamSubscriptionError> {
					const requested = yield* Ref.get(
						this.core.listeningRequested,
					);
					const subscribers = yield* Ref.get(this.core.subscribers);
					const current = yield* Ref.get(this.core.session);
					if (!requested || subscribers.size === 0 || current) return;

					const scope = yield* Scope.fork(
						this.core.rootScope,
						"sequential",
					);
					const makeSession = Effect.gen(
						function* (
							this: VaultObservation,
						): Effect.fn.Return<
							ObservationSession,
							VamSubscriptionError,
							Scope.Scope
						> {
							const closed = yield* Deferred.make<void>();
							const intake =
								yield* Queue.unbounded<EventAccumulatorCommand>();
							yield* Scope.addFinalizer(
								scope,
								Queue.shutdown(intake),
							);
							yield* Scope.addFinalizer(
								scope,
								Deferred.succeed(closed, undefined),
							);

							yield* this.acquireListenerEffect(
								"create",
								(file) => this.onCreate(intake, file),
							);
							yield* this.acquireListenerEffect(
								"rename",
								(file, oldPath) =>
									this.onRename(intake, file, oldPath),
							);
							yield* this.acquireListenerEffect(
								"delete",
								(file) => this.onDelete(intake, file),
							);

							yield* runEventAccumulator(
								intake,
								this.options,
								(window) => this.publishWindowEffect(window),
								this.publishSubscriberBarrierEffect(),
							).pipe(Effect.forkIn(scope));

							return { closed, intake, scope };
						}.bind(this),
					).pipe(
						Effect.provideService(Scope.Scope, scope),
						Effect.onError((cause) =>
							Scope.close(scope, Exit.failCause(cause)),
						),
					);

					const session = yield* makeSession;
					yield* Ref.set(this.core.session, session);
				}.bind(this),
			),
		);
	});

	private readonly acquireListenerEffect = Effect.fn(
		"VaultObservation.acquireListener",
	)(function* <K extends "create" | "delete" | "rename">(
		this: VaultObservation,
		kind: K,
		callback: K extends "rename"
			? (file: TAbstractFile, oldPath: string) => void
			: (file: TAbstractFile) => void,
	): Effect.fn.Return<EventRef, VamSubscriptionError, Scope.Scope> {
		return yield* Effect.acquireRelease(
			Effect.try({
				catch: (cause) =>
					new VamSubscriptionError({
						cause,
						operation: `listen for ${kind}`,
					}),
				try: () => {
					if (kind === "rename") {
						return this.app.vault.on(
							"rename",
							callback as (
								file: TAbstractFile,
								oldPath: string,
							) => void,
						);
					}
					if (kind === "create") {
						return this.app.vault.on(
							"create",
							callback as (file: TAbstractFile) => void,
						);
					}
					return this.app.vault.on(
						"delete",
						callback as (file: TAbstractFile) => void,
					);
				},
			}),
			(ref) =>
				Effect.sync(() => this.app.vault.offref(ref)).pipe(
					Effect.catchCause((cause) =>
						Effect.logError(
							`[VaultObservation] Failed to release ${kind} listener`,
							Cause.squash(cause),
						),
					),
				),
		);
	});

	private readonly publishWindowEffect = Effect.fn(
		"VaultObservation.publishWindow",
	)(function* (
		this: VaultObservation,
		window: {
			readonly allObsidianEvents: VaultEvent[];
			readonly debug: {
				readonly endedAt: number;
				readonly startedAt: number;
			};
		},
	): Effect.fn.Return<void> {
		const subscribers = yield* Ref.get(this.core.subscribers);
		if (subscribers.size === 0) return;

		const events = collapseVaultEvents(window.allObsidianEvents);
		const roots = reduceRoots(events);
		const bulk: BulkVaultEvent = {
			debug: {
				collapsedCount: countEvents(events),
				endedAt: window.debug.endedAt,
				reduced: {
					rootDeletes: roots.filter(isDelete).length,
					rootRenames: roots.filter(isRename).length,
				},
				startedAt: window.debug.startedAt,
				trueCount: countEvents(window.allObsidianEvents),
			},
			events,
			roots,
		};

		yield* PubSub.publish(this.core.pubsub, { _tag: "Bulk", bulk });
	});

	private readonly publishSubscriberBarrierEffect = Effect.fn(
		"VaultObservation.publishSubscriberBarrier",
	)(function* (this: VaultObservation): Effect.fn.Return<void> {
		const subscribers = yield* Ref.get(this.core.subscribers);
		if (subscribers.size === 0) return;

		const barrier: SubscriberBarrier = {
			completed: yield* Deferred.make<void>(),
			remaining: yield* Ref.make(subscribers.size),
		};
		for (const subscriber of subscribers.values()) {
			yield* Ref.update(subscriber.pendingBarriers, (barriers) => {
				const next = new Set(barriers);
				next.add(barrier);
				return next;
			});
		}

		const published = yield* PubSub.publish(this.core.pubsub, {
			_tag: "Barrier",
			barrier,
		});
		if (!published) {
			for (const subscriber of subscribers.values()) {
				yield* this.releaseBarrierEffect(subscriber, barrier);
			}
		}
		yield* Deferred.await(barrier.completed);
	});

	private readonly subscriberLoopEffect = Effect.fn(
		"VaultObservation.subscriberLoop",
	)(function* (
		this: VaultObservation,
		state: SubscriberState,
		subscription: PubSub.Subscription<PublishedMessage>,
	): Effect.fn.Return<never> {
		while (true) {
			const message = yield* PubSub.take(subscription);
			if (message._tag === "Barrier") {
				yield* this.releaseBarrierEffect(state, message.barrier);
				continue;
			}

			yield* Ref.update(
				this.core.activeHandlerWork,
				(count) => count + 1,
			);
			yield* Effect.tryPromise({
				catch: (cause) => cause,
				try: () => state.handler(message.bulk),
			}).pipe(
				Effect.catch((cause) =>
					Effect.logError(
						"[VaultObservation] Subscriber failed",
						cause,
					),
				),
				Effect.ensuring(
					Ref.update(this.core.activeHandlerWork, (count) =>
						Math.max(0, count - 1),
					),
				),
			);
		}
	});

	private readonly closeSubscriptionEffect = Effect.fn(
		"VaultObservation.closeSubscription",
	)(function* (this: VaultObservation, id: number): Effect.fn.Return<void> {
		const removed = yield* Ref.modify(
			this.core.subscribers,
			(subscribers) => {
				const state = subscribers.get(id);
				if (!state) return [undefined, subscribers];
				const next = new Map(subscribers);
				next.delete(id);
				return [{ finalSubscriber: next.size === 0, state }, next];
			},
		);
		if (!removed) return;

		if (removed.finalSubscriber) yield* this.stopSessionEffect();
		yield* Scope.close(removed.state.scope, Exit.void);
	});

	private readonly stopSessionEffect = Effect.fn(
		"VaultObservation.stopSession",
	)(function* (this: VaultObservation): Effect.fn.Return<void> {
		yield* this.core.sessionLock.withPermits(1)(
			Effect.gen(
				function* (this: VaultObservation): Effect.fn.Return<void> {
					const subscribers = yield* Ref.get(this.core.subscribers);
					if (subscribers.size > 0) return;

					const session = yield* Ref.getAndSet(
						this.core.session,
						null,
					);
					if (session) yield* Scope.close(session.scope, Exit.void);
				}.bind(this),
			),
		);
	});

	private readonly releasePendingBarriersEffect = Effect.fn(
		"VaultObservation.releasePendingBarriers",
	)(function* (
		this: VaultObservation,
		state: SubscriberState,
	): Effect.fn.Return<void> {
		const pending = yield* Ref.getAndSet(state.pendingBarriers, new Set());
		for (const barrier of pending) {
			yield* this.completeBarrierEffect(barrier);
		}
	});

	private readonly releaseBarrierEffect = Effect.fn(
		"VaultObservation.releaseBarrier",
	)(function* (
		this: VaultObservation,
		state: SubscriberState,
		barrier: SubscriberBarrier,
	): Effect.fn.Return<void> {
		const pending = yield* Ref.modify(state.pendingBarriers, (barriers) => {
			if (!barriers.has(barrier)) return [false, barriers];
			const next = new Set(barriers);
			next.delete(barrier);
			return [true, next];
		});
		if (pending) yield* this.completeBarrierEffect(barrier);
	});

	private readonly completeBarrierEffect = Effect.fn(
		"VaultObservation.completeBarrier",
	)(function* (barrier: SubscriberBarrier): Effect.fn.Return<void> {
		const completed = yield* Ref.modify(barrier.remaining, (remaining) => {
			const next = Math.max(0, remaining - 1);
			return [next === 0, next];
		});
		if (completed) yield* Deferred.succeed(barrier.completed, undefined);
	});

	private onCreate(
		intake: Queue.Enqueue<EventAccumulatorCommand>,
		file: TAbstractFile,
	): void {
		this.runCallbackEffect(intake, file.path, () =>
			makeVaultEventForFileCreated(file),
		);
	}

	private onRename(
		intake: Queue.Enqueue<EventAccumulatorCommand>,
		file: TAbstractFile,
		oldPath: string,
	): void {
		const program = Effect.gen(
			function* (this: VaultObservation): Effect.fn.Return<void> {
				const newPathIsSelf = yield* this.selfEvents.shouldIgnoreEffect(
					file.path,
				);
				const oldPathIsSelf =
					yield* this.selfEvents.shouldIgnoreEffect(oldPath);
				if (newPathIsSelf && oldPathIsSelf) return;

				const event = tryMakeVaultEventForFileRenamed(file, oldPath);
				if (event.success) {
					yield* Queue.offer(intake, {
						_tag: "Event",
						event: event.event,
					});
				}
			}.bind(this),
		);
		this.runCallback(program);
	}

	private onDelete(
		intake: Queue.Enqueue<EventAccumulatorCommand>,
		file: TAbstractFile,
	): void {
		this.runCallbackEffect(intake, file.path, () =>
			makeVaultEventForFileDeleted(file),
		);
	}

	private runCallbackEffect(
		intake: Queue.Enqueue<EventAccumulatorCommand>,
		path: string,
		makeEvent: () => VaultEvent,
	): void {
		const program = Effect.gen(
			function* (this: VaultObservation): Effect.fn.Return<void> {
				if (yield* this.selfEvents.shouldIgnoreEffect(path)) return;
				yield* Queue.offer(intake, {
					_tag: "Event",
					event: makeEvent(),
				});
			}.bind(this),
		);
		this.runCallback(program);
	}

	private runCallback(program: Effect.Effect<void>): void {
		const logged = program.pipe(
			Effect.catchCause((cause) =>
				Effect.logError(
					"[VaultObservation] Vault callback failed",
					Cause.squash(cause),
				),
			),
		);
		const exit = Effect.runSyncExitWith(this.core.context)(logged);
		if (Exit.isFailure(exit)) {
			logger.error(
				"[VaultObservation] Vault callback logging failed",
				Cause.squash(exit.cause),
			);
		}
	}
}

function countEvents(events: readonly VaultEvent[]) {
	let renames = 0;
	let creates = 0;
	let deletes = 0;

	for (const event of events) {
		switch (event.kind) {
			case VaultEventKind.FileRenamed:
			case VaultEventKind.FolderRenamed:
				renames++;
				break;
			case VaultEventKind.FileCreated:
			case VaultEventKind.FolderCreated:
				creates++;
				break;
			case VaultEventKind.FileDeleted:
			case VaultEventKind.FolderDeleted:
				deletes++;
				break;
		}
	}

	return { creates, deletes, renames };
}
