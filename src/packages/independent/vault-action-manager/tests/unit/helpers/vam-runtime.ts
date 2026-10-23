import { Effect, Exit, type Layer, ManagedRuntime } from "effect";
import {
	type VamSetupError,
	VamShutdownError,
} from "../../../src/effect/errors";
import type { VamLiveServices, VaultIo } from "../../../src/effect/ports";
import type { VamRuntimeFailure } from "../../../src/effect/services";
import type { DispatchBatchCoordinator } from "../../../src/impl/actions-processing/dispatch-batch";

/**
 * A ManagedRuntime over VAM's ports alone, for tests of the parts the
 * Vault Action Manager's Layer composes: the dispatch worker, the ports.
 */
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

/** Starts the coordinator's worker on `runtime`, as the Layer forks it. */
export function startCoordinator<C extends DispatchBatchCoordinator>(
	runtime: VamRuntime,
	coordinator: C,
): C {
	void runtime.runPromiseExit(coordinator.run);
	return coordinator;
}

/** The `VaultIo` members a test of dispatch or file access never reaches. */
export const unusedVaultIoMembers = {
	fileSystem: { caseInsensitive: false },
	listen: () => Effect.die("not used"),
	tree: {
		getAbstractFileByPath: () => null,
		getRoot: () => {
			throw new Error("not used");
		},
	},
} satisfies Pick<VaultIo["Service"], "fileSystem" | "listen" | "tree">;
