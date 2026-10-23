import { type Context, Effect } from "effect";
import { type VamSetupError, VamShutdownError } from "./errors";
import type { VamPorts } from "./ports";

export type VamRuntimeFailure<E> = E | VamSetupError | VamShutdownError;

/** Supplies VAM's services to a program, leaving it environment-free. */
export type VamProvide = <A, E>(
	program: Effect.Effect<A, E, VamPorts>,
) => Effect.Effect<A, VamRuntimeFailure<E>>;

/**
 * The services one Vault Action Manager built, which its programs run with
 * until it shuts down; from then on a program fails with
 * `VamShutdownError` instead of running.
 *
 * `context` holds VAM's ports and, when VAM brings its own, its tracer and
 * loggers. It never holds the builder's other services or its span, so a
 * program keeps its caller's parent span, annotations, and anything else
 * the caller's fiber carries.
 */
export class VamServices {
	private closed = false;

	constructor(private readonly context: Context.Context<VamPorts>) {}

	get isClosed(): boolean {
		return this.closed;
	}

	/** Refuses every program from now on. Idempotent. */
	close(): void {
		this.closed = true;
	}

	readonly provide: VamProvide = <A, E>(
		program: Effect.Effect<A, E, VamPorts>,
	): Effect.Effect<A, VamRuntimeFailure<E>> =>
		Effect.suspend<A, VamRuntimeFailure<E>, never>(() =>
			this.closed
				? Effect.fail(
						new VamShutdownError({
							cause: new Error(
								"Vault Action Manager has been shut down",
							),
							operation: "provide",
						}),
					)
				: Effect.provideContext(program, this.context),
		);
}
