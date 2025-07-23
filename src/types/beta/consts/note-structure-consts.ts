import z from 'zod/v4';
import {
	LINGUISTIC_UNIT_STR_TYPES,
	MORPHEM,
	LEXEM,
} from './linguistics-consts';
import { Morphem } from 'prompts/endgame/zod/types';

// Meta note types
export const NavigationSchema = z.literal('Navigation');
export type Navigation = z.infer<typeof NavigationSchema>;
export const NAVIGATION = NavigationSchema.value;

export const EtymologySchema = z.literal('Etymology');
export type Etymology = z.infer<typeof EtymologySchema>;
export const ETYMOLOGY = EtymologySchema.value;

export const GrammarSchema = z.literal('Grammar');
export type Grammar = z.infer<typeof GrammarSchema>;
export const GRAMMAR = GrammarSchema.value;

export const UnknownSchema = z.literal('Unknown');
export type Unknown = z.infer<typeof UnknownSchema>;
export const UNKNOWN = UnknownSchema.value;

export const META_NOTE_STR_TYPES = [NAVIGATION, GRAMMAR, UNKNOWN] as const;

export const NOTE_STR_TYPES = [
	...LINGUISTIC_UNIT_STR_TYPES,
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

export const ContextsSchema = z.literal('Contexts');
export type Contexts = z.infer<typeof ContextsSchema>;
export const CONTEXTS = ContextsSchema.value;

export const UserNotesSchema = z.literal('UserNotes');
export type UserNotes = z.infer<typeof UserNotesSchema>;
export const USER_NOTES = UserNotesSchema.value;

export const BasicLexicalRelationsSchema = z.literal('BasicLexicalRelations');
export type BasicLexicalRelations = z.infer<typeof BasicLexicalRelationsSchema>;
export const BASIC_LEXICAL_RELATIONS = BasicLexicalRelationsSchema.value;

export const AdvancedLexicalRelationsSchema = z.literal(
	'AdvancedLexicalRelations'
);
export type AdvancedLexicalRelations = z.infer<
	typeof AdvancedLexicalRelationsSchema
>;
export const ADVANCED_LEXICAL_RELATIONS = AdvancedLexicalRelationsSchema.value;

export const MorphemsSchema = z.literal('Morphems');
export type Morphems = z.infer<typeof MorphemsSchema>;
export const MORPHEMS = MorphemsSchema.value;

export const InflectionsSchema = z.literal('Inflections');
export type Inflections = z.infer<typeof InflectionsSchema>;
export const INFLECTIONS = InflectionsSchema.value;

export const TagsSchema = z.literal('Tags');
export type Tags = z.infer<typeof TagsSchema>;
export const TAGS = TagsSchema.value;

export const HeaderSchema = z.literal('Header');
export type Header = z.infer<typeof HeaderSchema>;
export const HEADER = HeaderSchema.value;

export const DerivationalMorphologicalFamilySchema = z.literal(
	'DerivationalMorphologicalFamily'
);
export type DerivationalMorphologicalFamily = z.infer<
	typeof DerivationalMorphologicalFamilySchema
>;
export const DERIVATIONAL_MORPHOLOGICAL_FAMILY =
	DerivationalMorphologicalFamilySchema.value; // abandon, abandonment, abandoned

export const LDOCE_DefinitionSchema = z.literal('LDOCE_definition');
export type LDOCE_Definition = z.infer<typeof LDOCE_DefinitionSchema>;
export const LDOCE_DEFINITION = LDOCE_DefinitionSchema.value;

export const SemanticRelationsSchema = z.literal('SemanticRelationss');
export type SemanticRelations = z.infer<typeof SemanticRelationsSchema>;
export const SEMANTIC_RELATIONS = SemanticRelationsSchema.value;


// LexicalRelations
export const SynonymSchema = z.literal('Synonym');
export type Synonym = z.infer<typeof SynonymSchema>;
export const SYNONYM = SynonymSchema.value;

export const AntonymSchema = z.literal('Antonym');
export type Antonym = z.infer<typeof AntonymSchema>;
export const ANTONYM = AntonymSchema.value;

export const HyponymSchema = z.literal('Hyponym');
export type Hyponym = z.infer<typeof HyponymSchema>;
export const HYPONYM = HyponymSchema.value;

export const HypernymSchema = z.literal('Hypernym');
export type Hypernym = z.infer<typeof HypernymSchema>;
export const HYPERNYM = HypernymSchema.value;

export const MeronymSchema = z.literal('Meronym');
export type Meronym = z.infer<typeof MeronymSchema>;
export const MERONYM = MeronymSchema.value;

export const HolonymSchema = z.literal('Holonym');
export type Holonym = z.infer<typeof HolonymSchema>;
export const HOLONYM = HolonymSchema.value;

export const TroponymSchema = z.literal('Troponym');
export type Troponym = z.infer<typeof TroponymSchema>;
export const TROPONYM = TroponymSchema.value;

export const ComplementSchema = z.literal('Complement');
export type Complement = z.infer<typeof ComplementSchema>;
export const COMPLEMENT = ComplementSchema.value;


// c Semantics | String
// Dimension: intensity, [force, manner, frequency, degree, count/amount, certainty, obligation,  space]]
// Scalar degree: 3 | [-5:5] 
// Usage context: taste, smell, argument, person
// Domains: emotion, physical sensation, personality


// -5 = negligible     
// -4 = minimal        
// -3 = weak           
// -2 = softened       
// -1 = low            
// 0 = neutral        
// 1 = mild  
// 2 = moderate  
// 3 = strong  
// 4 = intense  
// 5 = extreme