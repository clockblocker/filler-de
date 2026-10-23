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
import { currentSpanRef } from "../../effect/current-operation";
import type { VamSubscriptionError } from "../../effect/errors";
import type { VaultListen } from "../../effect/ports";
import { splitPathFromAbstractInternal } from "../../helpers/pathfinder/path-codecs/split-and-abstract/split-path-from-abstract";
import { type OriginFilter, originFilter } from "../../types/event-origin";
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
	type Attribution,
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
 * A subscriber's handler. Each call runs as its own root span,
 * `vam.observation.deliver`, linked to the subscription and to the Dispatch
 * Batches that caused what it delivers. A failure is logged there with its
 * whole `Cause`.
 */
type ObservationHandler<M, E> = (message: M) => Effect.Effect<void, E>;

/**
 * Runs one delivery to a subscriber under `span` and waits for it to end,
 * however it ends: a failure is logged in the delivery's span and goes no
 * further, so the next delivery still comes.
 */
type Deliver<M> = (
	message: M,
	span: Tracer.SpanOptionsNoTrace,
) => Effect.Effect<void>;

/** One subscriber's part of a window: its message and the callbacks it holds. */
type Delivery<Ev, M> = {
	readonly callbacks: readonly ObservedCallback<Ev>[];
	readonly message: M;
};

/** Runs `effect` with no parent span, so the spans it opens are roots. */
const detached = <A, E>(effect: Effect.Effect<A, E>): Effect.Effect<A, E> =>
	Effect.updateContext(effect, (context: Context.Context<never>) =>
		Context.omit(Tracer.ParentSpan)(context),
	);

type SubscriberBarrier = {
	readonly completed: Deferred.Deferred<void>;
	readonly remaining: Ref.Ref<number>;
};

/**
 * A closed window, with the callbacks it holds and its message for every
 * subscriber whose cursor precedes them all and who takes every origin in
 * it. `byFilter` holds the message for each other selection (origin
 * filter and scope), built once by its first subscriber.
 */
type PublishedWindow<Ev, M> = {
	readonly byFilter: Map<string, M>;
	readonly shared: M;
	readonly window: BulkWindow<ObservedCallback<Ev>>;
};

type PublishedMessage<Ev, M> =
	| { readonly _tag: "Bulk"; readonly published: PublishedWindow<Ev, M> }
	| { readonly _tag: "Barrier"; readonly barrier: SubscriberBarrier };

type SubscriberState<Ev, M> = {
	/**
	 * The latest callback this subscriber must not receive. Read and moved
	 * synchronously, so a snapshot can move it on the tick it was taken.
	 */
	readonly cursor: { value: number };
	/** Completes when delivery may begin; complete from the start unless gated. */
	readonly delivering: Deferred.Deferred<void>;
	readonly deliver: Deliver<M>;
	/** The callbacks this subscriber receives, by origin and scope. */
	readonly selection: Selection<Ev>;
	readonly id: number;
	readonly pendingBarriers: Ref.Ref<ReadonlySet<SubscriberBarrier>>;
	readonly scope: Scope.Closeable;
	/** The span the subscription was made under; each delivery links to it. */
	readonly subscriptionSpan: Tracer.AnySpan | undefined;
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
	readonly subscribers: Ref.Ref<ReadonlyMap<number, SubscriberState<Ev, M>>>;
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
	/** What a delivery's span says of the message it delivers. */
	readonly describe: (message: M) => Readonly<Record<string, number>>;
};

type VaultObservationOptions = Partial<EventAccumulatorOptions> & {
	/** Shared by every channel of one VAM, so their cursors compare. */
	readonly sequence?: VaultCallbackSequence;
};

type MdModifyObservationOptions = VaultObservationOptions & {
	/** Labels Obsidian's link rewriting after a VAM rename `LinkUpdate`. */
	readonly linkUpdates?: LinkUpdates;
};

/**
 * The events a subscription is about, such as Markdown changes below a
 * folder. Subscriptions with equal keys keep the same events.
 */
export type ObservationScope<Ev> = {
	readonly accepts: (event: Ev) => boolean;
	readonly key: string;
};

/**
 * Which callbacks a subscriber receives: those of an origin its filter
 * takes, within its scope. Subscribers with equal keys receive the same
 * callbacks of a window their cursors precede.
 */
type Selection<Ev> = {
	readonly accepts: (callback: ObservedCallback<Ev>) => boolean;
	readonly key: string;
};

function selectionOf<Ev>(
	filter: OriginFilter,
	scope: ObservationScope<Ev> | undefined,
): Selection<Ev> {
	if (scope === undefined)
		return {
			accepts: ({ origin }) => filter.accepts(origin),
			key: filter.key,
		};
	return {
		accepts: ({ event, origin }) =>
			filter.accepts(origin) && scope.accepts(event),
		key: `${filter.key}|${scope.key}`,
	};
}

type SubscribeOptions<Ev> = {
	/** Deliver nothing until `start`; messages wait in the subscription meanwhile. */
	readonly gated?: boolean;
	/** The origins to deliver; VAM's own writes are left out by default. */
	readonly filter?: OriginFilter;
	/**
	 * The events to deliver; all by default. A window with none of them is
	 * not delivered at all.
	 */
	readonly scope?: ObservationScope<Ev>;
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
		subscribers: yield* Ref.make<
			ReadonlyMap<number, SubscriberState<Ev, M>>
		>(new Map()),
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
		function* <E>(
			this: VaultObservation<Ev, M>,
			handler: ObservationHandler<M, E>,
			options: SubscribeOptions<Ev> = {},
		): Effect.fn.Return<
			VaultObservationSubscription<M>,
			VamSubscriptionError
		> {
			const subscriptionSpan = yield* currentSpanRef;
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
			const state: SubscriberState<Ev, M> = {
				cursor: { value: this.sequence.current },
				deliver: this.deliverTo(handler),
				delivering,
				id,
				pendingBarriers,
				scope,
				selection: selectionOf(
					options.filter ?? originFilter(),
					options.scope,
				),
				subscriptionSpan,
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

			// Detached from the subscribing span: each delivery is a root of
			// its own, linked back to the subscription.
			yield* this.subscriberLoopEffect(state, subscription).pipe(
				detached,
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
							).pipe(detached, Effect.forkIn(scope));

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

	private readonly publishWindowEffect = Effect.fnUntraced(function* (
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
		selection: Selection<Ev>,
		window: BulkWindow<ObservedCallback<Ev>>,
		whole: M,
	): M | null {
		return (
			this.deliveryAfter(cursor, selection, window, whole)?.message ??
			null
		);
	}

	/**
	 * `messageAfter`'s message, with the callbacks it holds; `null` when it
	 * holds none.
	 */
	private deliveryAfter(
		cursor: number,
		selection: Selection<Ev>,
		window: BulkWindow<ObservedCallback<Ev>>,
		whole: M,
		byFilter?: Map<string, M>,
	): Delivery<Ev, M> | null {
		const callbacks = window.allObsidianEvents;
		const kept = callbacks.filter(
			(callback) => callback.seq > cursor && selection.accepts(callback),
		);
		if (kept.length === 0) return null;
		return {
			callbacks: kept,
			message:
				kept.length === callbacks.length
					? whole
					: this.messageOf(window, kept, cursor, selection, byFilter),
		};
	}

	/** The message of `kept`, the part of `window` one subscriber receives. */
	private messageOf(
		window: BulkWindow<ObservedCallback<Ev>>,
		kept: ObservedCallback<Ev>[],
		cursor: number,
		selection: Selection<Ev>,
		byFilter: Map<string, M> | undefined,
	): M {
		const callbacks = window.allObsidianEvents;
		const build = () =>
			this.buildMessage({ ...window, allObsidianEvents: kept });
		// Subscribers whose cursor precedes the window differ only by
		// selection, so those with one selection share one message.
		const first = callbacks[0];
		if (
			byFilter === undefined ||
			first === undefined ||
			first.seq <= cursor
		)
			return build();
		const cached = byFilter.get(selection.key);
		if (cached !== undefined) return cached;
		const message = build();
		byFilter.set(selection.key, message);
		return message;
	}

	private afterCursor(state: SubscriberState<Ev, M>, message: M): M | null {
		const window = this.windowsByMessage.get(message);
		if (!window) return message;
		return this.messageAfter(
			state.cursor.value,
			state.selection,
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
			state: SubscriberState<Ev, M>,
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
	private readonly publishSubscriberBarrierEffect = Effect.fnUntraced(
		function* (
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
		},
	);

	/**
	 * Delivers one message at a time: the next waits until the handler is
	 * done with this one, so a subscriber handles windows in order.
	 */
	private readonly subscriberLoopEffect = Effect.fnUntraced(function* (
		this: VaultObservation<Ev, M>,
		state: SubscriberState<Ev, M>,
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
			const delivery = this.deliveryAfter(
				state.cursor.value,
				state.selection,
				message.published.window,
				message.published.shared,
				message.published.byFilter,
			);
			if (delivery === null) continue;

			yield* Ref.update(
				this.core.activeHandlerWork,
				(count) => count + 1,
			);
			yield* state
				.deliver(delivery.message, this.deliverySpan(state, delivery))
				.pipe(
					Effect.ensuring(
						Ref.update(this.core.activeHandlerWork, (count) =>
							Math.max(0, count - 1),
						),
					),
				);
		}
	});

	/**
	 * `handler` as its subscriber's deliveries run it. Each delivery runs in
	 * a fiber of its own, scoped to the channel, so closing the subscription
	 * from inside the handler cannot interrupt it. The handler is suspended,
	 * so one that throws instead of failing fails that fiber, not the loop.
	 */
	private deliverTo<E>(handler: ObservationHandler<M, E>): Deliver<M> {
		const rootScope = this.core.rootScope;
		return (message, span) =>
			Effect.suspend(() => handler(message)).pipe(
				Effect.tapCause((cause) =>
					Cause.hasInterruptsOnly(cause)
						? Effect.void
						: Effect.logError(
								"[VaultObservation] Subscriber failed",
								cause,
							),
				),
				Effect.withSpan("vam.observation.deliver", span),
				Effect.forkIn(rootScope),
				Effect.flatMap(Fiber.await),
				Effect.asVoid,
			);
	}

	/**
	 * A delivery's span: a root, linked to the subscription and to each
	 * Dispatch Batch that caused a callback it delivers, once per batch.
	 */
	private deliverySpan(
		state: SubscriberState<Ev, M>,
		{ callbacks, message }: Delivery<Ev, M>,
	): Tracer.SpanOptionsNoTrace {
		const links: Tracer.SpanLink[] = [];
		if (state.subscriptionSpan !== undefined)
			links.push({
				attributes: { "vam.link": "subscription" },
				span: state.subscriptionSpan,
			});
		// Each batch once, with every origin its callbacks came by.
		const batches = new Map<
			Tracer.AnySpan,
			{ readonly operationId: string; readonly origins: Set<string> }
		>();
		const origins = new Set<string>();
		const operations = new Set<string>();
		for (const { dispatchSpan, origin } of callbacks) {
			origins.add(origin.kind);
			if (origin.kind === "External") continue;
			operations.add(origin.operationId);
			if (dispatchSpan === undefined) continue;
			const batch = batches.get(dispatchSpan);
			if (batch) batch.origins.add(origin.kind);
			else
				batches.set(dispatchSpan, {
					operationId: origin.operationId,
					origins: new Set([origin.kind]),
				});
		}
		for (const [span, batch] of batches)
			links.push({
				attributes: {
					"vam.link": "dispatch",
					"vam.operationId": batch.operationId,
					"vam.origin": [...batch.origins].sort().join(","),
				},
				span,
			});
		const attributes: Record<string, unknown> = {
			...this.source.describe(message),
			"vam.callbacks": callbacks.length,
			"vam.origin": [...origins].sort().join(","),
			"vam.subscriber": state.id,
			"vam.subscriber.filter": state.selection.key,
		};
		if (operations.size > 0)
			attributes["vam.operationIds"] = [...operations].join(",");
		return { attributes, links, root: true };
	}

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

	private readonly releasePendingBarriersEffect = Effect.fnUntraced(
		function* (
			this: VaultObservation<Ev, M>,
			state: SubscriberState<Ev, M>,
		): Effect.fn.Return<void> {
			const pending = yield* Ref.getAndSet(
				state.pendingBarriers,
				new Set(),
			);
			for (const barrier of pending) {
				yield* this.completeBarrierEffect(barrier);
			}
		},
	);

	private readonly releaseBarrierEffect = Effect.fnUntraced(function* (
		this: VaultObservation<Ev, M>,
		state: SubscriberState<Ev, M>,
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

	private readonly completeBarrierEffect = Effect.fnUntraced(function* (
		barrier: SubscriberBarrier,
	): Effect.fn.Return<void> {
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
			// The one log that cannot go through Effect: Obsidian calls
			// `vault.on` callbacks synchronously, and logging through
			// Effect is what failed.
			// biome-ignore lint/suspicious/noConsole: VAM's log of last resort, where Effect's loggers failed.
			console.error(
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
		describe: ({ events, roots }) => ({
			"vam.events": events.length,
			"vam.roots": roots.length,
		}),
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
				attribution: Attribution,
			) =>
				Queue.offer(intake, {
					_tag: "Event",
					event: { ...attribution, event, seq },
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
						const attribution =
							yield* selfEvents.attributeEffect(path);
						yield* offer(seq, makeEvent(), attribution);
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
						const attribution =
							yield* selfEvents.attributeRenameEffect(
								oldPath,
								file.path,
							);
						const event = tryMakeVaultEventForFileRenamed(
							file,
							oldPath,
						);
						if (event.success)
							yield* offer(seq, event.event, attribution);
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
	): Effect.fn.Return<Attribution> {
		const attribution = yield* selfEvents.attributeModifyEffect(path);
		if (attribution.origin.kind !== "External" || !linkUpdates)
			return attribution;
		return yield* linkUpdates.attributeEffect(path, mtime);
	});
	return {
		describe: ({ modifications }) => ({
			"vam.modifications": modifications.length,
		}),
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
							const { origin } =
								yield* selfEvents.attributeModifyEffect(
									file.path,
								);
							if (origin.kind === "Vam") return;
							return yield* Effect.logWarning(
								"[VaultObservation] Skipped a modify callback without a Markdown file stat",
								file.path,
							);
						}
						const attribution = yield* attribute(
							file.path,
							stat.value.mtime,
						);
						yield* Queue.offer(intake, {
							_tag: "Event",
							event: {
								...attribution,
								event: { splitPath, stat: stat.value },
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
