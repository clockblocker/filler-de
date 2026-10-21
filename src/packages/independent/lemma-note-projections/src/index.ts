import type { ProjectionInput } from "./context";
import { deriveInflection } from "./inflection";
import { deriveTags } from "./tags";

export type { PrincipalParts, ProjectionInput } from "./context";
export type { Case, Gender, GrammaticalNumber } from "./de/articles";
export { closedParadigm } from "./de/closed-paradigms";
export { compareGerman, type GermanComparisonInput } from "./de/comparison";
export {
	declineGermanNoun,
	type GermanNounInput,
	type NounCell,
	type NounDeclension,
	nounTable,
} from "./de/noun-declension";
export {
	conjugateGermanVerb,
	type GermanVerbInput,
} from "./de/verb-conjugation";
export { deriveInflection } from "./inflection";
export { type InflectionTable, renderTable, type TableRow } from "./table";
export { deriveTags } from "./tags";

/**
 * The Lemma note codec's `inflection` and `tags` hooks (#75). Spread them
 * into `serialize`'s `projections`.
 */
export const derivedProjections: {
	readonly inflection: (input: ProjectionInput) => string | undefined;
	readonly tags: (input: ProjectionInput) => readonly string[];
} = {
	inflection: deriveInflection,
	tags: deriveTags,
};
