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
 * What a German projection reads of one Lemma: the Lemma, the principal
 * parts its Paradigm gives, and its owned Surfaces.
 */
export type ProjectionInput = {
	readonly lemma: Dumling.Lemma;
	/**
	 * What the Lemma Paradigm's variants give one Licence Group or Reading
	 * (`interim.ts`). TODO(#120): the German Inflection Pack derives tables
	 * from the Paradigm itself.
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
