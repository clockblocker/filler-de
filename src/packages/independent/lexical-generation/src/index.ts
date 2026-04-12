export { createLexicalGenerationModule } from "./create-lexical-generation-module";
export type { LexicalGenerationError } from "./errors";
export {
	LexicalGenerationFailureKind,
	lexicalGenerationError,
} from "./errors";
export type {
	Case,
	Gender,
	GrammaticalNumber,
	InherentFeatures,
} from "@textfresser/linguistics";
export {
	createLexicalMeta,
	createMetaTagFromSelection,
} from "./lexical-meta";
export * from "./prompt-api";
export type {
	CreateLexicalGenerationModuleParams,
	GenerateLexicalInfoOptions,
	LexicalCore,
	LexicalFeatures,
	LexicalGenerationModule,
	LexicalInfo,
	LexicalInfoField,
	LexicalInfoGenerator,
	LexicalInflectionForm,
	LexicalMeta,
	LexicalMorpheme,
	LexicalRelationKind,
	LexicalRelations,
	LexemeInflections,
	MorphemicBreakdown,
	ResolvedSelection,
	SelectionResolver,
	SenseDisambiguator,
	SenseMatchResult,
	StructuredFetchFn,
	ZodSchemaLike,
} from "./public-types";
export type { LexicalGenerationSettings } from "./settings";
