import type * as Dumling from "dumling/types";
import type * as Dumrel from "dumrel/types";

/**
 * The Reading Knowledge aspects a projection reads. dumrel's
 * `ReadingKnowledge` holds them in these shapes.
 */
export type ProjectedKnowledge = {
	readonly plural?: readonly string[] | "NoPlural" | "PluralOnly" | undefined;
	readonly conjugationClass?: readonly Dumrel.ConjugationClass[] | undefined;
	readonly preterite?: readonly string[] | undefined;
	readonly presentSingular?:
		| {
				readonly first: readonly string[];
				readonly second: readonly string[];
				readonly third: readonly string[];
		  }
		| undefined;
	readonly pastParticiple?: readonly string[] | undefined;
	readonly subjunctivePast?: readonly string[] | undefined;
};

/**
 * What a projection reads of one Reading part. It is the structural subset
 * of the Lemma note codec's `ReadingProjectionContext`, so the functions
 * here plug into its `inflection` and `tags` hooks without this package
 * depending on the codec.
 */
export type ProjectionInput = {
	readonly lemma: Dumling.Lemma;
	readonly entry: { readonly knowledge?: ProjectedKnowledge | undefined };
	readonly ownedSurfaces: readonly { readonly surface: Dumling.Surface }[];
};

/** A Lemma's Core Features as a plain record. */
export function coreOf(
	lemma: Dumling.Lemma,
): Readonly<Record<string, unknown>> {
	return lemma.coreFeatures as Readonly<Record<string, unknown>>;
}
