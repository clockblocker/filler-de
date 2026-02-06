import { z } from "zod";
import { LINGUISTIC_UNIT_KINDS_STR_TYPES } from "../../../../linguistics/old-enums";
import { UNKNOWN } from "../../../literals";

// Meta note types
export const NavigationSchema = z.literal("Navigation");
export type Navigation = z.infer<typeof NavigationSchema>;
export const NAVIGATION = NavigationSchema.value;

export const EtymologySchema = z.literal("Etymology");
export type Etymology = z.infer<typeof EtymologySchema>;
export const ETYMOLOGY = EtymologySchema.value;

export const GrammarSchema = z.literal("Grammar");
export type Grammar = z.infer<typeof GrammarSchema>;
export const GRAMMAR = GrammarSchema.value;

export const META_NOTE_STR_TYPES = [NAVIGATION, GRAMMAR, UNKNOWN] as const;

export const NOTE_STR_TYPES = [
	...LINGUISTIC_UNIT_KINDS_STR_TYPES,
	...META_NOTE_STR_TYPES,
] as const;

export const MetaNoteTypeSchema = z.enum(META_NOTE_STR_TYPES);
export const NoteTypeSchema = z.enum(NOTE_STR_TYPES);

export type MetaNoteType = z.infer<typeof MetaNoteTypeSchema>;
export type NoteType = z.infer<typeof NoteTypeSchema>;

export const MetaNoteType = MetaNoteTypeSchema.enum;
export const NoteType = NoteTypeSchema.enum;

export const META_NOTE_TYPES = MetaNoteTypeSchema.options;
export const NOTE_TYPES = NoteTypeSchema.options;

// Note Sections

export const ContextsSchema = z.literal("Contexts");
export type Contexts = z.infer<typeof ContextsSchema>;
export const CONTEXTS = ContextsSchema.value;

export const UserNotesSchema = z.literal("UserNotes");
export type UserNotes = z.infer<typeof UserNotesSchema>;
export const USER_NOTES = UserNotesSchema.value;

export const BasicLexicalRelationsSchema = z.literal("BasicLexicalRelations");
export type BasicLexicalRelations = z.infer<typeof BasicLexicalRelationsSchema>;
export const BASIC_LEXICAL_RELATIONS = BasicLexicalRelationsSchema.value;

export const AdvancedLexicalRelationsSchema = z.literal(
	"AdvancedLexicalRelations",
);
export type AdvancedLexicalRelations = z.infer<
	typeof AdvancedLexicalRelationsSchema
>;
export const ADVANCED_LEXICAL_RELATIONS = AdvancedLexicalRelationsSchema.value;

export const MorphemsSchema = z.literal("Morphems");
export type Morphems = z.infer<typeof MorphemsSchema>;
export const MORPHEMS = MorphemsSchema.value;

export const InflectionsSchema = z.literal("Inflections");
export type Inflections = z.infer<typeof InflectionsSchema>;
export const INFLECTIONS = InflectionsSchema.value;

export const TagsSchema = z.literal("Tags");
export type Tags = z.infer<typeof TagsSchema>;
export const TAGS = TagsSchema.value;

export const HeaderSchema = z.literal("Header");
export type Header = z.infer<typeof HeaderSchema>;
export const HEADER = HeaderSchema.value;

export const DerivationalMorphologicalFamilySchema = z.literal(
	"DerivationalMorphologicalFamily",
);
export type DerivationalMorphologicalFamily = z.infer<
	typeof DerivationalMorphologicalFamilySchema
>;
export const DERIVATIONAL_MORPHOLOGICAL_FAMILY =
	DerivationalMorphologicalFamilySchema.value; // abandon, abandonment, abandoned

export const LDOCE_DefinitionSchema = z.literal("LDOCE_definition");
export type LDOCE_Definition = z.infer<typeof LDOCE_DefinitionSchema>;
export const LDOCE_DEFINITION = LDOCE_DefinitionSchema.value;

export const SemanticRelationsSchema = z.literal("SemanticRelationss");
export type SemanticRelations = z.infer<typeof SemanticRelationsSchema>;
export const SEMANTIC_RELATIONS = SemanticRelationsSchema.value;

// Dimension: intensity, [force, manner, frequency, degree, count/amount, certainty, obligation,  space]]
// Scalar degree: 3 | [-5:5]
// Usage context: taste, smell, argument, person
// Domains: emotion, physical sensation, personality
