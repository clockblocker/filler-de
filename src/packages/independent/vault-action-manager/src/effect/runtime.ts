import { Effect, Exit, type Layer, ManagedRuntime } from "effect";
import { type VamSetupError, VamShutdownError } from "./errors";
import type { VamLiveServices } from "./ports";

export type VamRuntimeFailure<E> = E | VamSetupError | VamShutdownError;

export class VamRuntime {
	private disposePromise: Promise<void> | null = null;
	private disposed = false;

	constructor(
		private readonly managed: ManagedRuntime.ManagedRuntime<
			VamLiveServices,
			VamSetupError
		>,
	) {}

	get isDisposed(): boolean {
		return this.disposed;
	}

	/**
	 * Supplies the runtime's memoized live services while keeping the returned
	 * program as an ordinary, environment-free Effect for external consumers.
	 */
	provide<A, E>(
		program: Effect.Effect<A, E, VamLiveServices>,
	): Effect.Effect<A, VamRuntimeFailure<E>> {
		return Effect.suspend<A, VamRuntimeFailure<E>, never>(() => {
			if (this.disposed) {
				return Effect.fail(this.shutdownError("provide"));
			}
			return this.managed.contextEffect.pipe(
				Effect.flatMap((context) => Effect.provide(program, context)),
			);
		});
	}

	runPromiseExit<A, E>(
		program: Effect.Effect<A, E, VamLiveServices>,
	): Promise<Exit.Exit<A, VamRuntimeFailure<E>>> {
		if (this.disposed) {
			return Promise.resolve(Exit.fail(this.shutdownError("runPromise")));
		}
		return this.managed.runPromiseExit(program);
	}

	runSyncExit<A, E>(
		program: Effect.Effect<A, E, VamLiveServices>,
	): Exit.Exit<A, VamRuntimeFailure<E>> {
		if (this.disposed) {
			return Exit.fail(this.shutdownError("runSync"));
		}
		return this.managed.runSyncExit(program);
	}

	dispose(): Promise<void> {
		if (this.disposePromise) return this.disposePromise;

		this.disposed = true;
		this.disposePromise = this.managed.dispose();
		return this.disposePromise;
	}

	private shutdownError(operation: string): VamShutdownError {
		return new VamShutdownError({
			cause: new Error("Vault Action Manager runtime has been disposed"),
			operation,
		});
	}
}

export function createVamRuntime(
	live: Layer.Layer<VamLiveServices, VamSetupError>,
): VamRuntime {
	return new VamRuntime(ManagedRuntime.make(live));
}
