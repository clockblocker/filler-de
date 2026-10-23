/**
 * Classify's second stage behind a port (#74): resolution takes the
 * `ClassifyPlan` segmentation built and resolves each `UnitRef` to its
 * Reading, then writes each occurrence's link. `dumgenUnitResolver`
 * (`resolution/`) is the plugin's; `pendingUnitResolver` resolves nothing
 * and writes nothing.
 *
 * Keeping the hand-off a typed plan lets lazy click-time resolution become
 * one policy value later, rehydrating a `UnitRef` from the cache instead of
 * receiving it, rather than a second implementation.
 */
import type { Jev, Luna } from "dumgen";
import { Context, Data, Effect } from "effect";
import type { ClassifyPlan, UnitRef } from "./types";

/** What resolution made of one `UnitRef`. */
export type UnitResolution =
	| {
			readonly _tag: "Resolved";
			readonly ref: UnitRef;
			/** The Reading note's vault path, which the unit's links now name. */
			readonly readingPath: string;
			/** The vault path of the Reading's Lemma note. */
			readonly lemmaPath: string;
			/** How many of the unit's occurrences now link to the Reading. */
			readonly linked: number;
	  }
	| {
			readonly _tag: "Pending";
			readonly ref: UnitRef;
			readonly reason: string;
	  };

export class UnitResolverError extends Data.TaggedError("UnitResolverError")<{
	readonly cause: unknown;
	readonly message: string;
}> {}

export class UnitResolver extends Context.Service<
	UnitResolver,
	{
		/**
		 * Resolves every unit of the plan and writes its occurrences' links.
		 * It answers once per unit, in the plan's order, asking dumgen on
		 * the build of the Classify it serves.
		 */
		resolve(
			plan: ClassifyPlan,
		): Effect.Effect<
			readonly UnitResolution[],
			UnitResolverError,
			Jev | Luna
		>;
	}
>()("textfresser/classify/UnitResolver") {}

export const PENDING_RESOLUTION_REASON = "Resolution is switched off";

/** A resolver that leaves every unit Pending and writes nothing. */
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
