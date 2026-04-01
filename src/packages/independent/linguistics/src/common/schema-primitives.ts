import {
	CaseValueSchema,
	NumberValueSchema,
} from "./enums/inflection/feature-values";
import { POSSchema, PARTS_OF_SPEECH } from "./enums/linguistic-units/lexem/pos";
import {
	MorphemeKindSchema,
	MORPHEME_KINDS,
} from "./enums/linguistic-units/morphem/morpheme-kind";
import {
	PhrasemeKindSchema,
	PHRASEM_KINDS,
} from "./enums/linguistic-units/phrasem/phrasem-kind";
import {
	LinguisticUnitKindSchema,
	SurfaceKindSchema,
} from "./enums/core";

export const LexicalPosSchema = POSSchema;
export const LEXICAL_POS_VALUES = PARTS_OF_SPEECH;

export const LexicalPhrasemeKindSchema = PhrasemeKindSchema;
export const LEXICAL_PHRASEME_KIND_VALUES = PHRASEM_KINDS;

export const LexicalSurfaceKindSchema = SurfaceKindSchema;
export const LexicalLinguisticUnitKindSchema = LinguisticUnitKindSchema;

export const LexicalCaseSchema = CaseValueSchema;
export const LexicalNumberSchema = NumberValueSchema;

export const LexicalMorphemeKindSchema = MorphemeKindSchema;
export const LEXICAL_MORPHEME_KIND_VALUES = MORPHEME_KINDS;
