import {
	Cause,
	type Context,
	Deferred,
	Effect,
	Exit,
	Option,
	PubSub,
	Queue,
	Ref,
	Scope,
	Semaphore,
} from "effect";
import { type App, type EventRef, type TAbstractFile, TFile } from "obsidian";
import { VamSubscriptionError } from "../../effect/errors";
import { splitPathFromAbstractInternal } from "../../helpers/pathfinder/path-codecs/split-and-abstract/split-path-from-abstract";
import { logger } from "../../internal/logger";
import { decodeFileStatOption } from "../../types/file-stat";
import { type VaultEvent, VaultEventKind } from "../../types/vault-event";
import {
	type EventAccumulatorCommand,
	type EventAccumulatorOptions,
	runEventAccumulator,
} from "./bulk-event-emmiter/batteries/event-accumulator";
import { collapseVaultEvents } from "./bulk-event-emmiter/batteries/processing-chain/collapse";
import { reduceRoots } from "./bulk-event-emmiter/batteries/processing-chain/reduce-roots";
import type { BulkVaultEvent } from "./bulk-event-emmiter/types/bulk/bulk-vault-event";
import type { BulkWindow } from "./bulk-event-emmiter/types/bulk/bulk-window";
import { isDelete, isRename } from "./bulk-event-emmiter/types/bulk/helpers";
import {
	type BulkMdModifyEvent,
	coalesceMdModifications,
	type MdFileModification,
} from "./md-modify-event";
import type { SelfEventTracker } from "./self-event-tracker";
import {
	makeVaultEventForFileCreated,
	makeVaultEventForFileDeleted,
	tryMakeVaultEventForFileRenamed,
} from "./vault-events-for-events";

type ObservationHandler<M> = (message: M) => Promise<void>;

type SubscriberBarrier = {
	readonly completed: Deferred.Deferred<void>;
	readonly remaining: Ref.Ref<number>;
};

type PublishedMessage<M> =
	| { readonly _tag: "Bulk"; readonly bulk: M }
	| { readonly _tag: "Barrier"; readonly barrier: SubscriberBarrier };

type SubscriberState<M> = {
	readonly handler: ObservationHandler<M>;
	readonly id: number;
	readonly pendingBarriers: Ref.Ref<ReadonlySet<SubscriberBarrier>>;
	readonly scope: Scope.Closeable;
};

type ObservationSession<Ev> = {
	readonly closed: Deferred.Deferred<void>;
	readonly intake: Queue.Queue<EventAccumulatorCommand<Ev>>;
	readonly scope: Scope.Closeable;
};

type ObservationCore<Ev, M> = {
	readonly activeHandlerWork: Ref.Ref<number>;
	readonly context: Context.Context<never>;
	readonly listeningRequested: Ref.Ref<boolean>;
	readonly nextSubscriberId: Ref.Ref<number>;
	readonly pubsub: PubSub.PubSub<PublishedMessage<M>>;
	readonly rootScope: Scope.Closeable;
	readonly session: Ref.Ref<ObservationSession<Ev> | null>;
	readonly sessionLock: Semaphore.Semaphore;
	readonly subscribers: Ref.Ref<ReadonlyMap<number, SubscriberState<M>>>;
};

/** Runs one Obsidian callback program synchronously in the VAM runtime. */
type RunCallback = (program: Effect.Effect<void>) => void;

/**
 * One observation channel: which Obsidian callbacks enter its windows and how
 * a closed window becomes the message its subscribers receive.
 */
type ObservationSource<Ev, M> = {
	readonly listen: (
		intake: Queue.Enqueue<EventAccumulatorCommand<Ev>>,
		runCallback: RunCallback,
	) => Effect.Effect<void, VamSubscriptionError, Scope.Scope>;
	readonly publish: (window: BulkWindow<Ev>) => M;
};

type VaultObservationOptions = Partial<EventAccumulatorOptions>;

type VaultObservationSubscription = {
	readonly close: Effect.Effect<void>;
};

const makeObservationCore = Effect.fn("makeObservationCore")(function* <
	Ev,
	M,
>(): Effect.fn.Return<ObservationCore<Ev, M>> {
	const context = yield* Effect.context<never>();
	const rootScope = yield* Scope.make("sequential");
	const pubsub = yield* PubSub.unbounded<PublishedMessage<M>>();
	yield* Scope.addFinalizer(rootScope, PubSub.shutdown(pubsub));
	return {
		activeHandlerWork: yield* Ref.make(0),
		context,
		listeningRequested: yield* Ref.make(false),
		nextSubscriberId: yield* Ref.make(0),
		pubsub,
		rootScope,
		session: yield* Ref.make<ObservationSession<Ev> | null>(null),
		sessionLock: yield* Semaphore.make(1),
		subscribers: yield* Ref.make<ReadonlyMap<number, SubscriberState<M>>>(
			new Map(),
		),
	};
});

/**
 * Effect-native Vault observation. Construct it inside the VAM runtime with
 * `makeEffect` or `makeMdModifyEffect` so callbacks and scoped fibers capture
 * that runtime's context.
 *
 * Each instance is one independent channel with its own listeners, windows,
 * and subscribers. The Markdown-modify channel therefore never changes the
 * timing or content of Bulk Vault Events.
 */
export class VaultObservation<Ev = VaultEvent, M = BulkVaultEvent> {
	private readonly core: ObservationCore<Ev, M>;
	private readonly options: EventAccumulatorOptions;

	private constructor(
		private readonly source: ObservationSource<Ev, M>,
		options: VaultObservationOptions,
		core: ObservationCore<Ev, M>,
	) {
		this.options = {
			maxWindowMs: options.maxWindowMs ?? 2000,
			quietWindowMs: options.quietWindowMs ?? 250,
		};
		this.core = core;
	}

	/** Create, rename, and delete callbacks published as Bulk Vault Events. */
	static readonly makeEffect = Effect.fn("VaultObservation.makeEffect")(
		function* (
			app: App,
			selfEvents: SelfEventTracker,
			options: VaultObservationOptions = {},
		): Effect.fn.Return<VaultObservation> {
			const core = yield* makeObservationCore<
				VaultEvent,
				BulkVaultEvent
			>();
			return new VaultObservation(
				bulkVaultEventSource(app, selfEvents),
				options,
				core,
			);
		},
	);

	/** Markdown modify callbacks, coalesced per path within each window. */
	static readonly makeMdModifyEffect = Effect.fn(
		"VaultObservation.makeMdModifyEffect",
	)(function* (
		app: App,
		selfEvents: SelfEventTracker,
		options: VaultObservationOptions = {},
	): Effect.fn.Return<
		VaultObservation<MdFileModification, BulkMdModifyEvent>
	> {
		const core = yield* makeObservationCore<
			MdFileModification,
			BulkMdModifyEvent
		>();
		return new VaultObservation(
			mdModifySource(app, selfEvents),
			options,
			core,
		);
	});

	readonly startEffect = Effect.fn("VaultObservation.start")(function* (
		this: VaultObservation<Ev, M>,
	): Effect.fn.Return<void, VamSubscriptionError> {
		yield* Ref.set(this.core.listeningRequested, true);
		yield* this.ensureSessionEffect();
	});

	readonly subscribeEffect = Effect.fn("VaultObservation.subscribe")(
		function* (
			this: VaultObservation<Ev, M>,
			handler: ObservationHandler<M>,
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
			const state: SubscriberState<M> = {
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
		function* (this: VaultObservation<Ev, M>): Effect.fn.Return<void> {
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
		this: VaultObservation<Ev, M>,
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
	)(function* (this: VaultObservation<Ev, M>): Effect.fn.Return<number> {
		return yield* Ref.get(this.core.activeHandlerWork);
	});

	readonly disposeEffect = Effect.fn("VaultObservation.dispose")(function* (
		this: VaultObservation<Ev, M>,
	): Effect.fn.Return<void> {
		yield* Ref.set(this.core.subscribers, new Map());
		yield* Ref.set(this.core.session, null);
		yield* Scope.close(this.core.rootScope, Exit.void);
	});

	private readonly ensureSessionEffect = Effect.fn(
		"VaultObservation.ensureSession",
	)(function* (
		this: VaultObservation<Ev, M>,
	): Effect.fn.Return<void, VamSubscriptionError> {
		yield* this.core.sessionLock.withPermits(1)(
			Effect.gen(
				function* (
					this: VaultObservation<Ev, M>,
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
							this: VaultObservation<Ev, M>,
						): Effect.fn.Return<
							ObservationSession<Ev>,
							VamSubscriptionError,
							Scope.Scope
						> {
							const closed = yield* Deferred.make<void>();
							const intake =
								yield* Queue.unbounded<
									EventAccumulatorCommand<Ev>
								>();
							yield* Scope.addFinalizer(
								scope,
								Queue.shutdown(intake),
							);
							yield* Scope.addFinalizer(
								scope,
								Deferred.succeed(closed, undefined),
							);

							yield* this.source.listen(intake, (program) =>
								this.runCallback(program),
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

	private readonly publishWindowEffect = Effect.fn(
		"VaultObservation.publishWindow",
	)(function* (
		this: VaultObservation<Ev, M>,
		window: BulkWindow<Ev>,
	): Effect.fn.Return<void> {
		const subscribers = yield* Ref.get(this.core.subscribers);
		if (subscribers.size === 0) return;

		const bulk = this.source.publish(window);
		yield* PubSub.publish(this.core.pubsub, { _tag: "Bulk", bulk });
	});

	private readonly publishSubscriberBarrierEffect = Effect.fn(
		"VaultObservation.publishSubscriberBarrier",
	)(function* (this: VaultObservation<Ev, M>): Effect.fn.Return<void> {
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
		this: VaultObservation<Ev, M>,
		state: SubscriberState<M>,
		subscription: PubSub.Subscription<PublishedMessage<M>>,
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
	)(function* (
		this: VaultObservation<Ev, M>,
		id: number,
	): Effect.fn.Return<void> {
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
	)(function* (this: VaultObservation<Ev, M>): Effect.fn.Return<void> {
		yield* this.core.sessionLock.withPermits(1)(
			Effect.gen(
				function* (
					this: VaultObservation<Ev, M>,
				): Effect.fn.Return<void> {
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
		this: VaultObservation<Ev, M>,
		state: SubscriberState<M>,
	): Effect.fn.Return<void> {
		const pending = yield* Ref.getAndSet(state.pendingBarriers, new Set());
		for (const barrier of pending) {
			yield* this.completeBarrierEffect(barrier);
		}
	});

	private readonly releaseBarrierEffect = Effect.fn(
		"VaultObservation.releaseBarrier",
	)(function* (
		this: VaultObservation<Ev, M>,
		state: SubscriberState<M>,
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

type VaultListenerKind = "create" | "delete" | "modify" | "rename";

const acquireVaultListener = Effect.fn("VaultObservation.acquireListener")(
	function* <K extends VaultListenerKind>(
		app: App,
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
						return app.vault.on(
							"rename",
							callback as (
								file: TAbstractFile,
								oldPath: string,
							) => void,
						);
					}
					if (kind === "create") {
						return app.vault.on(
							"create",
							callback as (file: TAbstractFile) => void,
						);
					}
					if (kind === "modify") {
						return app.vault.on(
							"modify",
							callback as (file: TAbstractFile) => void,
						);
					}
					return app.vault.on(
						"delete",
						callback as (file: TAbstractFile) => void,
					);
				},
			}),
			(ref) =>
				Effect.sync(() => app.vault.offref(ref)).pipe(
					Effect.catchCause((cause) =>
						Effect.logError(
							`[VaultObservation] Failed to release ${kind} listener`,
							Cause.squash(cause),
						),
					),
				),
		);
	},
);

function bulkVaultEventSource(
	app: App,
	selfEvents: SelfEventTracker,
): ObservationSource<VaultEvent, BulkVaultEvent> {
	return {
		listen: Effect.fn("VaultObservation.listenForBulk")(function* (
			intake: Queue.Enqueue<EventAccumulatorCommand>,
			runCallback: RunCallback,
		): Effect.fn.Return<void, VamSubscriptionError, Scope.Scope> {
			const offerUnlessSelf = (
				path: string,
				makeEvent: () => VaultEvent,
			) =>
				runCallback(
					Effect.gen(function* () {
						if (yield* selfEvents.shouldIgnoreEffect(path)) return;
						yield* Queue.offer(intake, {
							_tag: "Event",
							event: makeEvent(),
						});
					}),
				);

			yield* acquireVaultListener(app, "create", (file) =>
				offerUnlessSelf(file.path, () =>
					makeVaultEventForFileCreated(file),
				),
			);
			yield* acquireVaultListener(app, "rename", (file, oldPath) =>
				runCallback(
					Effect.gen(function* () {
						const newPathIsSelf =
							yield* selfEvents.shouldIgnoreEffect(file.path);
						const oldPathIsSelf =
							yield* selfEvents.shouldIgnoreEffect(oldPath);
						if (newPathIsSelf && oldPathIsSelf) return;

						const event = tryMakeVaultEventForFileRenamed(
							file,
							oldPath,
						);
						if (event.success) {
							yield* Queue.offer(intake, {
								_tag: "Event",
								event: event.event,
							});
						}
					}),
				),
			);
			yield* acquireVaultListener(app, "delete", (file) =>
				offerUnlessSelf(file.path, () =>
					makeVaultEventForFileDeleted(file),
				),
			);
		}),
		publish: (window) => {
			const events = collapseVaultEvents(window.allObsidianEvents);
			const roots = reduceRoots(events);
			return {
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
		},
	};
}

function mdModifySource(
	app: App,
	selfEvents: SelfEventTracker,
): ObservationSource<MdFileModification, BulkMdModifyEvent> {
	return {
		listen: Effect.fn("VaultObservation.listenForMdModify")(function* (
			intake: Queue.Enqueue<EventAccumulatorCommand<MdFileModification>>,
			runCallback: RunCallback,
		): Effect.fn.Return<void, VamSubscriptionError, Scope.Scope> {
			// Expectations recorded while nobody listened may belong to
			// callbacks that already fired. A spurious echo is harmless; a
			// hidden hand edit is not.
			yield* selfEvents.clearModifiesEffect();
			yield* acquireVaultListener(app, "modify", (file) => {
				if (!(file instanceof TFile) || file.extension !== "md") return;
				// Obsidian mutates `file.stat` in place, so copy it now.
				const stat = decodeFileStatOption(file.stat);
				const splitPath = splitPathFromAbstractInternal(file);
				runCallback(
					Effect.gen(function* () {
						if (
							yield* selfEvents.shouldIgnoreModifyEffect(
								file.path,
							)
						) {
							return;
						}
						if (
							Option.isNone(stat) ||
							splitPath.kind !== "MdFile"
						) {
							return yield* Effect.logWarning(
								"[VaultObservation] Skipped a modify callback without a Markdown file stat",
								file.path,
							);
						}
						yield* Queue.offer(intake, {
							_tag: "Event",
							event: { splitPath, stat: stat.value },
						});
					}),
				);
			});
		}),
		publish: (window) => ({
			debug: {
				endedAt: window.debug.endedAt,
				startedAt: window.debug.startedAt,
				trueCount: window.allObsidianEvents.length,
			},
			modifications: coalesceMdModifications(window.allObsidianEvents),
		}),
	};
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
