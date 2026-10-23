/**
 * The plugin's one Effect runtime, built in `onload` from `PluginLive` and
 * disposed in `onunload`.
 *
 * Obsidian enters it only at an edge, and each edge opens the root span of
 * what the user did: `obsidian.onload`, `command.<id>`, `user-event.<kind>`,
 * `settings.update` or `e2e.<hook>`. A failure is logged under that span, so
 * it lands in the recent trace whole, and is never lost at the edge. Once
 * the runtime is disposed, an edge runs nothing: a late Obsidian callback
 * is a no-op, and an E2E hook rejects.
 */
import { formatCause } from "@textfresser/vault-action-manager/diagnostics";
import {
	Cause,
	Data,
	Effect,
	Exit,
	type Fiber,
	Layer,
	ManagedRuntime,
} from "effect";

/** The root span an edge opens. */
export type EdgeSpan =
	| "obsidian.onload"
	| `command.${string}`
	| `user-event.${string}`
	| "settings.update"
	| `e2e.${string}`;

/** An E2E hook's program failed, or ran after unload: its whole cause. */
export class PluginEdgeError extends Data.TaggedError("PluginEdgeError")<{
	readonly edge: EdgeSpan;
	readonly cause: Cause.Cause<unknown>;
	readonly message: string;
}> {}

/** A synchronous read reached the runtime after unload. */
export class PluginUnloadedError extends Data.TaggedError(
	"PluginUnloadedError",
)<{ readonly message: string }> {}

/**
 * Runs programs on the plugin runtime for the code that still hops into it
 * from outside an Effect (#227 removes these hops). Its programs are
 * traced and logged like any other, as root spans of their own.
 */
export type EffectRunner<ER = never> = {
	readonly runFork: <A, E>(
		effect: Effect.Effect<A, E>,
	) => Fiber.Fiber<A, E | ER>;
	readonly runPromise: <A, E>(effect: Effect.Effect<A, E>) => Promise<A>;
	readonly runPromiseExit: <A, E>(
		effect: Effect.Effect<A, E>,
	) => Promise<Exit.Exit<A, E | ER>>;
};

/** `PluginRuntime.readSync`, for code that holds only it. */
export type ReadSync = <A, E>(
	effect: Effect.Effect<A, E>,
) => Exit.Exit<A, unknown>;

export type PluginRuntime<R, ER> = {
	/** Fire and forget, under `obsidian.onload`. */
	readonly onload: <A, E>(effect: Effect.Effect<A, E, R>) => void;
	/**
	 * A command, under `command.<id>`: resolves once it ended, and never
	 * rejects; a failure is logged under its span.
	 */
	readonly command: <A, E>(
		id: string,
		effect: Effect.Effect<A, E, R>,
	) => Promise<void>;
	/** A user's gesture, under `user-event.<kind>`, as `command` runs. */
	readonly userEvent: <A, E>(
		kind: string,
		effect: Effect.Effect<A, E, R>,
	) => Promise<void>;
	/** Applying changed settings, under `settings.update`, as `command` runs. */
	readonly settings: <A, E>(effect: Effect.Effect<A, E, R>) => Promise<void>;
	/**
	 * An E2E hook the driver awaits, under `e2e.<hook>`: resolves with its
	 * value, or rejects with a `PluginEdgeError` that keeps the whole cause.
	 */
	readonly e2e: <A, E>(
		hook: string,
		effect: Effect.Effect<A, E, R>,
	) => Promise<A>;
	/**
	 * A synchronous read made inside a DOM or editor callback to decide that
	 * same callback, such as the selection a copy reads. It opens no span:
	 * such events are frequent, and the read is small.
	 */
	readonly readSync: <A, E>(
		effect: Effect.Effect<A, E, R>,
	) => Exit.Exit<A, E | ER | PluginUnloadedError>;
	/** For the hops that remain; see `EffectRunner`. */
	readonly hops: EffectRunner<ER>;
	/**
	 * Interrupts every program still running at an edge, then releases the
	 * Layer's resources, newest first. Every later call shares the first.
	 */
	readonly dispose: () => Promise<void>;
};

/**
 * Makes the runtime and starts building `layer` at once. A build that fails
 * is told once, to `onBuildFailed`, with its whole cause; every edge then
 * fails as its program never runs.
 */
export function makePluginRuntime<R, ER>(
	layer: Layer.Layer<R, ER>,
	options: {
		readonly onBuildFailed: (cause: Cause.Cause<ER>) => void;
	},
): PluginRuntime<R, ER> {
	const managed = ManagedRuntime.make(layer, {
		memoMap: Layer.makeMemoMapUnsafe(),
	});
	let disposal: Promise<void> | undefined;

	managed.runCallback(Effect.void, {
		onExit: (exit) => {
			if (Exit.isFailure(exit) && !Cause.hasInterruptsOnly(exit.cause))
				options.onBuildFailed(exit.cause);
		},
	});

	/** `effect` under its edge's root span, its failure logged under it. */
	const atEdge = <A, E>(edge: EdgeSpan, effect: Effect.Effect<A, E, R>) =>
		effect.pipe(
			Effect.tapCause((cause) =>
				Cause.hasInterruptsOnly(cause)
					? Effect.void
					: Effect.logError(
							`[TextEaterPlugin] ${edge} failed`,
							cause,
						),
			),
			Effect.withSpan(edge, { root: true }),
		);

	const settle = <A, E>(
		edge: EdgeSpan,
		effect: Effect.Effect<A, E, R>,
	): Promise<void> =>
		disposal
			? Promise.resolve()
			: managed
					.runPromiseExit(atEdge(edge, effect))
					.then(() => undefined);

	function e2e<A, E>(
		hook: string,
		effect: Effect.Effect<A, E, R>,
	): Promise<A> {
		const edge: EdgeSpan = `e2e.${hook}`;
		const failed = (cause: Cause.Cause<unknown>): Promise<never> =>
			Promise.reject(
				new PluginEdgeError({
					cause,
					edge,
					message: `${edge} failed: ${formatCause(cause, { stack: false })}`,
				}),
			);
		if (disposal) return failed(Cause.fail(unloaded()));
		return managed
			.runPromiseExit(atEdge(edge, effect))
			.then((exit) =>
				Exit.isSuccess(exit) ? exit.value : failed(exit.cause),
			);
	}

	return {
		command: (id, effect) => settle(`command.${id}`, effect),
		dispose: () => {
			disposal ??= managed.dispose();
			return disposal;
		},
		e2e,
		hops: {
			runFork: (effect) => managed.runFork(effect),
			runPromise: (effect) => managed.runPromise(effect),
			runPromiseExit: (effect) => managed.runPromiseExit(effect),
		},
		onload: (effect) => {
			void settle("obsidian.onload", effect);
		},
		readSync: (effect) =>
			disposal ? Exit.fail(unloaded()) : managed.runSyncExit(effect),
		settings: (effect) => settle("settings.update", effect),
		userEvent: (kind, effect) => settle(`user-event.${kind}`, effect),
	};
}

const unloaded = () =>
	new PluginUnloadedError({ message: "the plugin has unloaded" });
