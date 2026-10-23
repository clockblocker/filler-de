import { Context, Effect, Option, Tracer } from "effect";
import type { VamOperation } from "../types/event-origin";

/**
 * The Dispatch Batch an action runs in, so a write deep in a file helper
 * records its modify Self Event under that batch's origin. Outside a batch,
 * as in a helper's own tests, writes are VAM's without a caller.
 */
export const CurrentVamOperation = Context.Reference<VamOperation>(
	"@textfresser/vault-action-manager/CurrentVamOperation",
	{ defaultValue: () => ({ caller: "vam", operationId: "vam" }) },
);

/**
 * The span of the Dispatch Batch an action runs in. The Self Events and
 * link rewrites the action causes record it, so the delivery of each event
 * links to the batch that caused it. Outside a batch there is none.
 */
export const CurrentDispatchSpan = Context.Reference<
	Tracer.AnySpan | undefined
>("@textfresser/vault-action-manager/CurrentDispatchSpan", {
	defaultValue: () => undefined,
});

/**
 * The current span as a link target: its ids alone, so whatever keeps it,
 * such as a Self Event waiting for its callback, keeps neither the span's
 * parents, nor its links, nor the value it ended with. `undefined` outside
 * a span.
 */
export const currentSpanRef: Effect.Effect<Tracer.ExternalSpan | undefined> =
	Effect.map(Effect.option(Effect.currentSpan), (span) =>
		Option.match(span, {
			onNone: () => undefined,
			onSome: ({ sampled, spanId, traceId }) =>
				Tracer.externalSpan({ sampled, spanId, traceId }),
		}),
	);

/** What the running create or rename found at its target. */
export type TargetCheck = { taken: boolean | undefined };

/**
 * Where a create or a rename records whether its target was taken, as the
 * vault's file system compares names, by the collision check it makes
 * immediately before it writes or moves (#202). The dispatch worker gives
 * each action its own; outside a batch nothing is recorded.
 */
export const CurrentTargetCheck = Context.Reference<TargetCheck | undefined>(
	"@textfresser/vault-action-manager/CurrentTargetCheck",
	{ defaultValue: () => undefined },
);

/** Records the running action's collision check; see `CurrentTargetCheck`. */
export const recordTargetTaken = Effect.fnUntraced(function* (taken: boolean) {
	const check = yield* CurrentTargetCheck;
	if (check) check.taken = taken;
});
