import {
	Cause,
	Context,
	Deferred,
	Effect,
	Exit,
	Fiber,
	Option,
	PubSub,
	Queue,
	Ref,
	Scope,
	Semaphore,
	Tracer,
} from "effect";
import { TFile } from "obsidian";
import { formatCause } from "../../diagnostics/format-cause";
import type { VamSubscriptionError } from "../../effect/errors";
import type { VaultListen } from "../../effect/ports";
import { splitPathFromAbstractInternal } from "../../helpers/pathfinder/path-codecs/split-and-abstract/split-path-from-abstract";
import { logger } from "../../internal/logger";
import {
	type OriginFilter,
	originFilter,
	type VaultEventOrigin,
} from "../../types/event-origin";
import { decodeFileStatOption } from "../../types/file-stat";
import {
	type ObservedVaultEvent,
	type VaultEvent,
	VaultEventKind,
} from "../../types/vault-event";
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
	type ObservedCallback,
	VaultCallbackSequence,
} from "./callback-sequence";
import type { LinkUpdates } from "./link-updates";
import {
	type BulkMdModifyEvent,
	coalesceMdModifications,
	type MdFileChange,
} from "./md-modify-event";
import type { SelfEventTracker } from "./self-event-tracker";
import {
	makeVaultEventForFileCreated,
	makeVaultEventForFileDeleted,
	tryMakeVaultEventForFileRenamed,
} from "./vault-events-for-events";

/**
 * Runs in VAM's runtime, so a handler's span and its failure's cause stay
 * attached to the vault callbacks that led to it.
 */
type ObservationHandler<M> = (message: M) => Effect.Effect<void, unknown>;

type SubscriberBarrier = {
	readonly completed: Deferred.Deferred<void>;
	readonly remaining: Ref.Ref<number>;
};

/**
 * A closed window, with the callbacks it holds and its message for every
 * subscriber whose cursor precedes them all and who takes every origin in
 * it. `byFilter` holds the message for each other origin filter, built
 * once by its first subscriber.
 */
type PublishedWindow<Ev, M> = {
	readonly byFilter: Map<string, M>;
	readonly shared: M;
	readonly window: BulkWindow<ObservedCallback<Ev>>;
};

type PublishedMessage<Ev, M> =
	| { readonly _tag: "Bulk"; readonly published: PublishedWindow<Ev, M> }
	| { readonly _tag: "Barrier"; readonly barrier: SubscriberBarrier };

type SubscriberState<M> = {
	/**
	 * The latest callback this subscriber must not receive. Read and moved
	 * synchronously, so a snapshot can move it on the tick it was taken.
	 */
	readonly cursor: { value: number };
	/** Completes when delivery may begin; complete from the start unless gated. */
	readonly delivering: Deferred.Deferred<void>;
	/** The origins this subscriber receives. */
	readonly filter: OriginFilter;
	readonly handler: ObservationHandler<M>;
	readonly id: number;
	readonly pendingBarriers: Ref.Ref<ReadonlySet<SubscriberBarrier>>;
	readonly scope: Scope.Closeable;
};

type ObservationSession<Ev> = {
	readonly closed: Deferred.Deferred<void>;
	readonly intake: Queue.Queue<EventAccumulatorCommand<ObservedCallback<Ev>>>;
	readonly scope: Scope.Closeable;
};

type ObservationCore<Ev, M> = {
	readonly activeHandlerWork: Ref.Ref<number>;
	readonly context: Context.Context<never>;
	readonly listeningRequested: Ref.Ref<boolean>;
	readonly nextSubscriberId: Ref.Ref<number>;
	readonly pubsub: PubSub.PubSub<PublishedMessage<Ev, M>>;
	/** Windows handed to subscribers so far; lets settling detect progress. */
	readonly publishedWindows: Ref.Ref<number>;
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
	/**
	 * Attaches the channel's listeners. Each listener numbers its callback
	 * from `sequence` on entry, then offers what survives filtering.
	 */
	readonly listen: (
		intake: Queue.Enqueue<EventAccumulatorCommand<ObservedCallback<Ev>>>,
		runCallback: RunCallback,
		sequence: VaultCallbackSequence,
	) => Effect.Effect<void, VamSubscriptionError, Scope.Scope>;
	/** Builds the message of the window's callbacks, each with its origin. */
	readonly publish: (window: BulkWindow<ObservedCallback<Ev>>) => M;
};

type VaultObservationOptions = Partial<EventAccumulatorOptions> & {
	/** Shared by every channel of one VAM, so their cursors compare. */
	readonly sequence?: VaultCallbackSequence;
};

type MdModifyObservationOptions = VaultObservationOptions & {
	/** Labels Obsidian's link rewriting after a VAM rename `LinkUpdate`. */
	readonly linkUpdates?: LinkUpdates;
};

type SubscribeOptions = {
	/** Deliver nothing until `start`; messages wait in the subscription meanwhile. */
	readonly gated?: boolean;
	/** The origins to deliver; VAM's own writes are left out by default. */
	readonly filter?: OriginFilter;
};

export type VaultObservationSubscription<M> = {
	/**
	 * The part of `message` this channel published after the subscriber's
	 * cursor, rebuilt as the channel builds messages; `null` when none of
	 * it is. A message the channel did not build is answered unchanged.
	 */
	readonly afterCursor: (message: M) => M | null;
	/**
	 * Completes once the handler has run for every callback the channel
	 * heard before the call, or skipped it as before its cursor or of an
	 * origin it does not take. It waits for the open window's own
	 * deadlines, never closes it early, and waits for a gated subscription
	 * to start.
	 */
	readonly caughtUp: Effect.Effect<void>;
	readonly close: Effect.Effect<void>;
	/** Delivers from now on only callbacks numbered after `cursor`. */
	readonly moveCursor: (cursor: number) => void;
	/** Opens delivery of a gated subscription. Idempotent. */
	readonly start: Effect.Effect<void>;
};

const makeObservationCore = Effect.fn("makeObservationCore")(function* <
	Ev,
	M,
>(): Effect.fn.Return<ObservationCore<Ev, M>> {
	// Without the builder's span: a vault callback is no part of the build
	// that happened to create its channel.
	const context = Context.omit(Tracer.ParentSpan)(
		yield* Effect.context<never>(),
	);
	const rootScope = yield* Scope.make("sequential");
	const pubsub = yield* PubSub.unbounded<PublishedMessage<Ev, M>>();
	yield* Scope.addFinalizer(rootScope, PubSub.shutdown(pubsub));
	return {
		activeHandlerWork: yield* Ref.make(0),
		context,
		listeningRequested: yield* Ref.make(false),
		nextSubscriberId: yield* Ref.make(0),
		publishedWindows: yield* Ref.make(0),
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
export class VaultObservation<
	Ev = VaultEvent,
	M extends object = BulkVaultEvent,
> {
	private readonly core: ObservationCore<Ev, M>;
	private readonly options: EventAccumulatorOptions;
	private readonly sequence: VaultCallbackSequence;
	/** The callbacks behind each message built, for `afterCursor`. */
	private readonly windowsByMessage = new WeakMap<
		M,
		BulkWindow<ObservedCallback<Ev>>
	>();

	private constructor(
		private readonly source: ObservationSource<Ev, M>,
		options: VaultObservationOptions,
		core: ObservationCore<Ev, M>,
	) {
		this.options = {
			maxWindowMs: options.maxWindowMs ?? 2000,
			quietWindowMs: options.quietWindowMs ?? 250,
		};
		this.sequence = options.sequence ?? new VaultCallbackSequence();
		this.core = core;
	}

	/** Create, rename, and delete callbacks published as Bulk Vault Events. */
	static readonly makeEffect = Effect.fn("VaultObservation.makeEffect")(
		function* (
			listen: VaultListen,
			selfEvents: SelfEventTracker,
			options: VaultObservationOptions = {},
		): Effect.fn.Return<VaultObservation> {
			const core = yield* makeObservationCore<
				VaultEvent,
				BulkVaultEvent
			>();
			return new VaultObservation(
				bulkVaultEventSource(listen, selfEvents),
				options,
				core,
			);
		},
	);

	/** Markdown modify callbacks, coalesced per path within each window. */
	static readonly makeMdModifyEffect = Effect.fn(
		"VaultObservation.makeMdModifyEffect",
	)(function* (
		listen: VaultListen,
		selfEvents: SelfEventTracker,
		options: MdModifyObservationOptions = {},
	): Effect.fn.Return<VaultObservation<MdFileChange, BulkMdModifyEvent>> {
		const core = yield* makeObservationCore<
			MdFileChange,
			BulkMdModifyEvent
		>();
		return new VaultObservation(
			mdModifySource(listen, selfEvents, options.linkUpdates),
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

	/**
	 * Subscribes `handler` to the windows published from now on. It receives
	 * only callbacks numbered after its cursor, which starts at the latest
	 * callback, so nothing Obsidian fired before the subscription reaches it,
	 * and only those of origins its filter takes.
	 */
	readonly subscribeEffect = Effect.fn("VaultObservation.subscribe")(
		function* (
			this: VaultObservation<Ev, M>,
			handler: ObservationHandler<M>,
			options: SubscribeOptions = {},
		): Effect.fn.Return<
			VaultObservationSubscription<M>,
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
			const delivering = yield* Deferred.make<void>();
			if (!options.gated) yield* Deferred.succeed(delivering, undefined);
			const state: SubscriberState<M> = {
				cursor: { value: this.sequence.current },
				delivering,
				filter: options.filter ?? originFilter(),
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
				afterCursor: (message) => this.afterCursor(state, message),
				caughtUp: this.caughtUpEffect(state),
				close: this.closeSubscriptionEffect(id),
				moveCursor: (cursor) => {
					state.cursor.value = cursor;
				},
				start: Deferred.succeed(delivering, undefined).pipe(
					Effect.asVoid,
				),
			};
		},
	);

	/** Whether this channel's listeners are attached. */
	readonly isListeningEffect = Effect.fn("VaultObservation.isListening")(
		function* (this: VaultObservation<Ev, M>): Effect.fn.Return<boolean> {
			return (yield* Ref.get(this.core.session)) !== null;
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

	/**
	 * Closes the open window, then waits until every subscriber has handled
	 * it and everything before it; a gated subscriber, until it has started
	 * and done so. The worker only publishes the barrier and the caller
	 * waits for it, so the channel keeps windowing and delivering to the
	 * other subscribers meanwhile.
	 */
	readonly whenIdleEffect = Effect.fn("VaultObservation.whenIdle")(function* (
		this: VaultObservation<Ev, M>,
	): Effect.fn.Return<void> {
		const session = yield* Ref.get(this.core.session);
		if (!session) return;

		const published = yield* Deferred.make<SubscriberBarrier | null>();
		const offered = yield* Queue.offer(session.intake, {
			_tag: "Settled",
			run: this.publishSubscriberBarrierEffect().pipe(
				Effect.flatMap((barrier) =>
					Deferred.succeed(published, barrier),
				),
				Effect.asVoid,
			),
		});
		if (!offered) return;
		yield* Effect.raceFirst(
			Deferred.await(published).pipe(
				Effect.flatMap((barrier) =>
					barrier === null
						? Effect.void
						: Deferred.await(barrier.completed),
				),
			),
			Deferred.await(session.closed),
		);
	});

	/** Number of windows published to subscribers since construction. */
	readonly publishedWindowCountEffect = Effect.fn(
		"VaultObservation.publishedWindowCount",
	)(function* (this: VaultObservation<Ev, M>): Effect.fn.Return<number> {
		return yield* Ref.get(this.core.publishedWindows);
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
									EventAccumulatorCommand<
										ObservedCallback<Ev>
									>
								>();
							yield* Scope.addFinalizer(
								scope,
								Queue.shutdown(intake),
							);
							yield* Scope.addFinalizer(
								scope,
								Deferred.succeed(closed, undefined),
							);

							yield* this.source.listen(
								intake,
								(program) => this.runCallback(program),
								this.sequence,
							);

							yield* runEventAccumulator(
								intake,
								this.options,
								(window) => this.publishWindowEffect(window),
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
		window: BulkWindow<ObservedCallback<Ev>>,
	): Effect.fn.Return<void> {
		const subscribers = yield* Ref.get(this.core.subscribers);
		if (subscribers.size === 0) return;

		const shared = this.buildMessage(window);
		yield* Ref.update(this.core.publishedWindows, (count) => count + 1);
		yield* PubSub.publish(this.core.pubsub, {
			_tag: "Bulk",
			published: { byFilter: new Map(), shared, window },
		});
	});

	private buildMessage(window: BulkWindow<ObservedCallback<Ev>>): M {
		const message = this.source.publish(window);
		this.windowsByMessage.set(message, window);
		return message;
	}

	/**
	 * The window's message as one subscriber may receive it: only the
	 * callbacks after its cursor and of origins it takes, collapsed among
	 * themselves; `null` when none is. Filtering precedes collapsing, so a
	 * rename chain that straddles the cursor yields only its part after it,
	 * and a chain of one caller's and another's renames only its part from
	 * the origins taken.
	 */
	private messageAfter(
		cursor: number,
		filter: OriginFilter,
		window: BulkWindow<ObservedCallback<Ev>>,
		whole: M,
		byFilter?: Map<string, M>,
	): M | null {
		const callbacks = window.allObsidianEvents;
		const kept = callbacks.filter(
			({ origin, seq }) => seq > cursor && filter.accepts(origin),
		);
		if (kept.length === callbacks.length) return whole;
		if (kept.length === 0) return null;
		const build = () =>
			this.buildMessage({ ...window, allObsidianEvents: kept });
		// Subscribers whose cursor precedes the window differ only by
		// filter, so those with one filter share one message.
		const first = callbacks[0];
		if (
			byFilter === undefined ||
			first === undefined ||
			first.seq <= cursor
		)
			return build();
		const cached = byFilter.get(filter.key);
		if (cached !== undefined) return cached;
		const message = build();
		byFilter.set(filter.key, message);
		return message;
	}

	private afterCursor(state: SubscriberState<M>, message: M): M | null {
		const window = this.windowsByMessage.get(message);
		if (!window) return message;
		return this.messageAfter(
			state.cursor.value,
			state.filter,
			window,
			message,
		);
	}

	/**
	 * Waits until `state`'s handler is done with every callback queued
	 * before the call: a barrier for it alone, published after the window
	 * those callbacks close in.
	 */
	private readonly caughtUpEffect = Effect.fn("vam.observation.caughtUp")(
		function* (
			this: VaultObservation<Ev, M>,
			state: SubscriberState<M>,
		): Effect.fn.Return<void> {
			const session = yield* Ref.get(this.core.session);
			if (!session) return;
			const barrier: SubscriberBarrier = {
				completed: yield* Deferred.make<void>(),
				remaining: yield* Ref.make(1),
			};
			yield* Ref.update(state.pendingBarriers, (barriers) =>
				new Set(barriers).add(barrier),
			);
			// Added before this check, the barrier is released by closing;
			// after it, here.
			const subscribed = (yield* Ref.get(this.core.subscribers)).has(
				state.id,
			);
			const release = this.releaseBarrierEffect(state, barrier);
			if (!subscribed) return yield* release;
			const offered = yield* Queue.offer(session.intake, {
				_tag: "AfterWindow",
				run: PubSub.publish(this.core.pubsub, {
					_tag: "Barrier",
					barrier,
				}).pipe(
					Effect.flatMap((published) =>
						published ? Effect.void : release,
					),
				),
			});
			if (!offered) return yield* release;
			yield* Effect.raceFirst(
				Deferred.await(barrier.completed),
				Deferred.await(session.closed),
			);
		},
	);

	/**
	 * Publishes a barrier every current subscriber releases once it has
	 * handled what was published before it, and answers it without
	 * waiting; `null` when there is no subscriber.
	 */
	private readonly publishSubscriberBarrierEffect = Effect.fn(
		"VaultObservation.publishSubscriberBarrier",
	)(function* (
		this: VaultObservation<Ev, M>,
	): Effect.fn.Return<SubscriberBarrier | null> {
		const subscribers = yield* Ref.get(this.core.subscribers);
		if (subscribers.size === 0) return null;

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
		return barrier;
	});

	private readonly subscriberLoopEffect = Effect.fn(
		"VaultObservation.subscriberLoop",
	)(function* (
		this: VaultObservation<Ev, M>,
		state: SubscriberState<M>,
		subscription: PubSub.Subscription<PublishedMessage<Ev, M>>,
	): Effect.fn.Return<never> {
		// A gated subscriber takes nothing, barriers included, until it
		// starts: settling waits, in its caller, for the windows it has yet
		// to handle.
		yield* Deferred.await(state.delivering);
		while (true) {
			const message = yield* PubSub.take(subscription);
			if (message._tag === "Barrier") {
				yield* this.releaseBarrierEffect(state, message.barrier);
				continue;
			}
			// The cursor is read as the message is taken, so a snapshot
			// taken while it waited drops what that snapshot holds.
			const bulk = this.messageAfter(
				state.cursor.value,
				state.filter,
				message.published.window,
				message.published.shared,
				message.published.byFilter,
			);
			if (bulk === null) continue;

			yield* Ref.update(
				this.core.activeHandlerWork,
				(count) => count + 1,
			);
			// The handler runs in a fiber of its own, scoped to the channel,
			// so closing the subscription from inside it cannot interrupt it.
			// Suspended, so a handler that throws instead of failing fails
			// that fiber, not this loop.
			const handling = yield* Effect.suspend(() =>
				state.handler(bulk),
			).pipe(
				Effect.withSpan("vam.observation.handle"),
				Effect.forkIn(this.core.rootScope),
			);
			yield* Fiber.await(handling).pipe(
				Effect.flatMap((exit) =>
					Exit.isFailure(exit) && !Cause.hasInterruptsOnly(exit.cause)
						? Effect.logError(
								"[VaultObservation] Subscriber failed",
								exit.cause,
							)
						: Effect.void,
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
					cause,
				),
			),
		);
		const exit = Effect.runSyncExitWith(this.core.context)(logged);
		if (Exit.isFailure(exit)) {
			logger.error(
				"[VaultObservation] Vault callback logging failed",
				formatCause(exit.cause),
			);
		}
	}
}

function bulkVaultEventSource(
	listen: VaultListen,
	selfEvents: SelfEventTracker,
): ObservationSource<VaultEvent, BulkVaultEvent> {
	return {
		listen: Effect.fn("VaultObservation.listenForBulk")(function* (
			intake: Queue.Enqueue<
				EventAccumulatorCommand<ObservedCallback<VaultEvent>>
			>,
			runCallback: RunCallback,
			sequence: VaultCallbackSequence,
		): Effect.fn.Return<void, VamSubscriptionError, Scope.Scope> {
			const offer = (
				seq: number,
				event: VaultEvent,
				origin: VaultEventOrigin,
			) =>
				Queue.offer(intake, {
					_tag: "Event",
					event: { event, origin, seq },
				});
			// Every callback is offered with its origin; each subscription
			// leaves out the origins it does not take.
			const offerAttributed = (
				path: string,
				makeEvent: () => VaultEvent,
			) => {
				const seq = sequence.next();
				runCallback(
					Effect.gen(function* () {
						const origin = yield* selfEvents.attributeEffect(path);
						yield* offer(seq, makeEvent(), origin);
					}),
				);
			};

			yield* listen("create", (file) =>
				offerAttributed(file.path, () =>
					makeVaultEventForFileCreated(file),
				),
			);
			yield* listen("rename", (file, oldPath) => {
				const seq = sequence.next();
				runCallback(
					Effect.gen(function* () {
						const origin = yield* selfEvents.attributeRenameEffect(
							oldPath,
							file.path,
						);
						const event = tryMakeVaultEventForFileRenamed(
							file,
							oldPath,
						);
						if (event.success)
							yield* offer(seq, event.event, origin);
					}),
				);
			});
			yield* listen("delete", (file) =>
				offerAttributed(file.path, () =>
					makeVaultEventForFileDeleted(file),
				),
			);
		}),
		publish: (window) => {
			const events = collapseVaultEvents(
				window.allObsidianEvents.map(
					({ event, origin }): ObservedVaultEvent => ({
						...event,
						origin,
					}),
				),
			);
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
					trueCount: countEvents(
						window.allObsidianEvents.map(({ event }) => event),
					),
				},
				events,
				roots,
			};
		},
	};
}

function mdModifySource(
	listen: VaultListen,
	selfEvents: SelfEventTracker,
	linkUpdates: LinkUpdates | undefined,
): ObservationSource<MdFileChange, BulkMdModifyEvent> {
	/**
	 * VAM's own write, else Obsidian's link updater after a VAM rename,
	 * predicted or within its window, else external.
	 */
	const attribute = Effect.fnUntraced(function* (
		path: string,
		mtime: number,
	): Effect.fn.Return<VaultEventOrigin> {
		const origin = yield* selfEvents.attributeModifyEffect(path);
		if (origin.kind !== "External" || !linkUpdates) return origin;
		return yield* linkUpdates.attributeEffect(path, mtime);
	});
	return {
		listen: Effect.fn("VaultObservation.listenForMdModify")(function* (
			intake: Queue.Enqueue<
				EventAccumulatorCommand<ObservedCallback<MdFileChange>>
			>,
			runCallback: RunCallback,
			sequence: VaultCallbackSequence,
		): Effect.fn.Return<void, VamSubscriptionError, Scope.Scope> {
			// Expectations recorded while nobody listened may belong to
			// callbacks that already fired. A spurious echo is harmless; a
			// hidden hand edit is not.
			yield* selfEvents.clearModifiesEffect();
			yield* listen("modify", (file) => {
				const seq = sequence.next();
				if (!(file instanceof TFile) || file.extension !== "md") return;
				// Obsidian mutates `file.stat` in place, so copy it now.
				const stat = decodeFileStatOption(file.stat);
				const splitPath = splitPathFromAbstractInternal(file);
				runCallback(
					Effect.gen(function* () {
						if (
							Option.isNone(stat) ||
							splitPath.kind !== "MdFile"
						) {
							// Still pops VAM's expectation for its own write.
							const origin =
								yield* selfEvents.attributeModifyEffect(
									file.path,
								);
							if (origin.kind === "Vam") return;
							return yield* Effect.logWarning(
								"[VaultObservation] Skipped a modify callback without a Markdown file stat",
								file.path,
							);
						}
						const origin = yield* attribute(
							file.path,
							stat.value.mtime,
						);
						yield* Queue.offer(intake, {
							_tag: "Event",
							event: {
								event: { splitPath, stat: stat.value },
								origin,
								seq,
							},
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
			modifications: coalesceMdModifications(
				window.allObsidianEvents.map(({ event, origin }) => ({
					...event,
					origin,
				})),
			),
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
