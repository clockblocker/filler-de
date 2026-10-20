/**
 * Classify's second stage behind a port (#74): resolution takes the
 * `ClassifyPlan` segmentation built and resolves each `UnitRef` to its
 * Reading, then writes each occurrence's link. Resolving and writing
 * belong to #64; until then the stub resolves nothing and writes nothing.
 *
 * Keeping the hand-off a typed plan lets lazy click-time resolution become
 * one policy value later, rehydrating a `UnitRef` from the cache instead of
 * receiving it, rather than a second implementation.
 */
import { Context, Effect, Schema } from "effect";
import type { ClassifyPlan, UnitRef } from "./types";

/** What resolution made of one `UnitRef`. */
export type UnitResolution =
	| {
			readonly _tag: "Resolved";
			readonly ref: UnitRef;
			/** The Lemma note's vault path. */
			readonly lemmaPath: string;
			/** The Reading's block ID in that note, without `^`. */
			readonly readingBlockId: string;
	  }
	| {
			readonly _tag: "Pending";
			readonly ref: UnitRef;
			readonly reason: string;
	  };

export class UnitResolverError extends Schema.TaggedError<UnitResolverError>()(
	"UnitResolverError",
	{
		cause: Schema.Defect(),
		message: Schema.String,
	},
) {}

export class UnitResolver extends Context.Service<
	UnitResolver,
	{
		/**
		 * Resolves every unit of the plan and writes its occurrences' links.
		 * It answers once per unit, in the plan's order.
		 */
		resolve(
			plan: ClassifyPlan,
		): Effect.Effect<readonly UnitResolution[], UnitResolverError>;
	}
>()("textfresser/classify/UnitResolver") {}

export const PENDING_RESOLUTION_REASON =
	"Resolution through dumgen is not wired yet (#64)";

/** The stand-in until #64: every unit stays Pending, and nothing is written. */
export const pendingUnitResolver: UnitResolver["Service"] = UnitResolver.of({
	resolve: (plan) =>
		Effect.succeed(
			plan.units.map(({ ref }) => ({
				_tag: "Pending" as const,
				reason: PENDING_RESOLUTION_REASON,
				ref,
			})),
		),
});
