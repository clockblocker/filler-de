/**
 * Where a long-lived plugin service is in its life. `Idle` is before its
 * first start; `Stopped` is after the plugin unloaded, and final.
 */
export type ServiceState<PauseReason extends string = never> =
	| { readonly kind: "Idle" }
	| { readonly kind: "Starting" }
	| { readonly kind: "Running" }
	| { readonly kind: "Paused"; readonly reason: PauseReason }
	| { readonly kind: "Failed"; readonly cause: unknown }
	| { readonly kind: "Stopped" };

export const ServiceState = {
	failed: (cause: unknown): ServiceState<never> =>
		Object.freeze({ cause, kind: "Failed" as const }),
	idle: Object.freeze({ kind: "Idle" as const }),
	paused: <PauseReason extends string>(
		reason: PauseReason,
	): ServiceState<PauseReason> =>
		Object.freeze({ kind: "Paused" as const, reason }),
	running: Object.freeze({ kind: "Running" as const }),
	starting: Object.freeze({ kind: "Starting" as const }),
	stopped: Object.freeze({ kind: "Stopped" as const }),
};
