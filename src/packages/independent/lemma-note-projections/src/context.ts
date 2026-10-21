import type * as Dumling from "dumling/types";
import type * as Dumrel from "dumrel/types";

/**
 * The principal parts a projection reads, in the shapes dumrel's Reading
 * Knowledge held them before they moved into the Lemma Paradigm
 * (texteater#1226).
 */
export type PrincipalParts = {
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
	/**
	 * TODO(#120): the codec passes none, since the Reading Knowledge no
	 * longer holds them, so a noun or verb gets no table and no inflection
	 * class tag until the batteries' Inflection Pack projects its tables.
	 */
	readonly principalParts?: PrincipalParts | undefined;
	readonly ownedSurfaces: readonly { readonly surface: Dumling.Surface }[];
	/** How the note links a Lemma; without it, a table links nothing. */
	readonly links?: {
		readonly lemma: (lemma: Dumling.Lemma) => string;
	};
};

/** A Lemma's Core Features as a plain record. */
export function coreOf(
	lemma: Dumling.Lemma,
): Readonly<Record<string, unknown>> {
	return lemma.coreFeatures as Readonly<Record<string, unknown>>;
}
