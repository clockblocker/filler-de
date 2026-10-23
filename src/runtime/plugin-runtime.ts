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
	Context,
	Data,
	Effect,
	Exit,
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

/** How a user event's edge runs its program. */
export type UserEventOptions = {
	/**
	 * False for an event too frequent to trace, such as a selection change:
	 * its program opens no span, and its failure is still logged. True by
	 * default.
	 */
	readonly traced?: boolean;
};

/** A synchronous read reached the runtime after unload. */
export class PluginUnloadedError extends Data.TaggedError(
	"PluginUnloadedError",
)<{ readonly message: string }> {}

/**
 * The edges a service opens from a plain Obsidian callback, such as a
 * palette command's (`PluginHost.command`): each runs its program on the
 * plugin runtime under the edge's root span, as `PluginRuntime.command`
 * and `userEvent` do. `makePluginRuntime` provides it to the Layer it
 * builds, so the runtime's own services can reach its edges.
 */
export class PluginEdges extends Context.Service<
	PluginEdges,
	{
		/** `PluginRuntime.command`, for a program that needs nothing more. */
		readonly command: <A, E>(
			id: string,
			effect: Effect.Effect<A, E>,
		) => Promise<void>;
		/** `PluginRuntime.userEvent`, for a program that needs nothing more. */
		readonly userEvent: <A, E>(
			kind: string,
			effect: Effect.Effect<A, E>,
			options?: UserEventOptions,
		) => Promise<void>;
	}
>()("textfresser/runtime/PluginEdges") {}

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
	/**
	 * A user's gesture, under `user-event.<kind>`, as `command` runs. It
	 * starts at once: a program that never waits has ended when this
	 * returns, inside the DOM event that started it.
	 */
	readonly userEvent: <A, E>(
		kind: string,
		effect: Effect.Effect<A, E, R>,
		options?: UserEventOptions,
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
	/**
	 * Interrupts every program still running at an edge, then releases the
	 * Layer's resources, newest first. Every later call shares the first.
	 */
	readonly dispose: () => Promise<void>;
};

/**
 * Makes the runtime and starts building `layer` at once, given the
 * runtime's own `PluginEdges`. A build that fails is told once, to
 * `onBuildFailed`, with its whole cause; every edge then fails as its
 * program never runs.
 */
export function makePluginRuntime<R, ER>(
	layer: Layer.Layer<R, ER, PluginEdges>,
	options: {
		readonly onBuildFailed: (cause: Cause.Cause<ER>) => void;
	},
): PluginRuntime<R, ER> {
	let disposal: Promise<void> | undefined;
	// Its methods run only once the runtime is built, so after `managed`.
	const edges = PluginEdges.of({
		command: (id, effect) => settle(`command.${id}`, effect),
		userEvent: (kind, effect, options) =>
			settle(`user-event.${kind}`, effect, options),
	});
	const managed = ManagedRuntime.make(
		Layer.provide(layer, Layer.succeed(PluginEdges, edges)),
		{ memoMap: Layer.makeMemoMapUnsafe() },
	);

	managed.runCallback(Effect.void, {
		onExit: (exit) => {
			if (Exit.isFailure(exit) && !Cause.hasInterruptsOnly(exit.cause))
				options.onBuildFailed(exit.cause);
		},
	});

	/**
	 * `effect` under its edge's root span, its failure logged under it; an
	 * untraced edge opens no span.
	 */
	const atEdge = <A, E>(
		edge: EdgeSpan,
		effect: Effect.Effect<A, E, R>,
		traced = true,
	) => {
		const logged = effect.pipe(
			Effect.tapCause((cause) =>
				Cause.hasInterruptsOnly(cause)
					? Effect.void
					: Effect.logError(
							`[TextEaterPlugin] ${edge} failed`,
							cause,
						),
			),
		);
		return traced ? Effect.withSpan(logged, edge, { root: true }) : logged;
	};

	function settle<A, E>(
		edge: EdgeSpan,
		effect: Effect.Effect<A, E, R>,
		options?: UserEventOptions,
	): Promise<void> {
		return disposal
			? Promise.resolve()
			: managed
					.runPromiseExit(atEdge(edge, effect, options?.traced))
					.then(() => undefined);
	}

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
		onload: (effect) => {
			void settle("obsidian.onload", effect);
		},
		readSync: (effect) =>
			disposal ? Exit.fail(unloaded()) : managed.runSyncExit(effect),
		settings: (effect) => settle("settings.update", effect),
		userEvent: (kind, effect, options) =>
			settle(`user-event.${kind}`, effect, options),
	};
}

const unloaded = () =>
	new PluginUnloadedError({ message: "the plugin has unloaded" });
