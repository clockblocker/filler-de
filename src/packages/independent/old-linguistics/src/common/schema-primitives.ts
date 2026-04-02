import {
	CaseValueSchema,
	NumberValueSchema,
	type CaseValue,
	type NumberValue,
} from "./enums/inflection/feature-values";
import {
	POSSchema,
	PARTS_OF_SPEECH,
	type POS,
} from "./enums/linguistic-units/lexem/pos";
import {
	MorphemeKindSchema,
	MORPHEME_KINDS,
	type MorphemeKind,
} from "./enums/linguistic-units/morphem/morpheme-kind";
import {
	PhrasemeKindSchema,
	PHRASEM_KINDS,
	type PhrasemeKind,
} from "./enums/linguistic-units/phrasem/phrasem-kind";
import {
	LinguisticUnitKindSchema,
	SurfaceKindSchema,
	type LinguisticUnitKind,
	type SurfaceKind,
} from "./enums/core";

export type LexicalPos = POS;
export const LexicalPosSchema = POSSchema;
export const LEXICAL_POS_VALUES = PARTS_OF_SPEECH;

export type LexicalPhrasemeKind = PhrasemeKind;
export const LexicalPhrasemeKindSchema = PhrasemeKindSchema;
export const LEXICAL_PHRASEME_KIND_VALUES = PHRASEM_KINDS;

export type LexicalSurfaceKind = SurfaceKind;
export const LexicalSurfaceKindSchema = SurfaceKindSchema;

export type LexicalLinguisticUnitKind = LinguisticUnitKind;
export const LexicalLinguisticUnitKindSchema = LinguisticUnitKindSchema;

export type LexicalCase = CaseValue;
export const LexicalCaseSchema = CaseValueSchema;

export type LexicalNumber = NumberValue;
export const LexicalNumberSchema = NumberValueSchema;

export type LexicalMorphemeKind = MorphemeKind;
export const LexicalMorphemeKindSchema = MorphemeKindSchema;
export const LEXICAL_MORPHEME_KIND_VALUES = MORPHEME_KINDS;
