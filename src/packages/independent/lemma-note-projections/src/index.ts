import { interimInflection, interimTags } from "./interim";

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
export {
	interimInflection,
	interimSurfaceAxes,
	interimTags,
	principalPartsOf,
} from "./interim";
export { type InflectionTable, renderTable, type TableRow } from "./table";
export { deriveTags } from "./tags";

/**
 * The Lemma note codec's `inflection` and `tags` hooks. TODO(#120): the
 * inflection hook becomes the German Inflection Pack's.
 */
export const derivedProjections = {
	inflection: interimInflection,
	tags: interimTags,
} as const;
