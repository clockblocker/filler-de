export {
	GermanAdjectiveClassificationSchema as LexicalAdjectiveClassificationSchema,
	GermanAdjectiveDistributionSchema as LexicalAdjectiveDistributionSchema,
	GermanAdjectiveGovernedPatternSchema as LexicalAdjectiveGovernedPatternSchema,
	GermanAdjectiveGradabilitySchema as LexicalAdjectiveGradabilitySchema,
	GermanAdjectiveValencySchema as LexicalAdjectiveValencySchema,
} from "./lexem/adjective/features";
export {
	GermanGenusSchema as LexicalGenusSchema,
	NounClassSchema as LexicalNounClassSchema,
} from "./lexem/noun/features";
export {
	GermanVerbConjugationSchema as LexicalVerbConjugationSchema,
	GermanVerbReflexivitySchema as LexicalVerbReflexivitySchema,
	GermanVerbSeparabilitySchema as LexicalVerbSeparabilitySchema,
	GermanVerbValencySchema as LexicalVerbValencySchema,
} from "./lexem/verb/features";
export { SeparabilitySchema } from "./morphem/prefix/features";
