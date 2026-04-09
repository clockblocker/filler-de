import type { Prettify } from "src/types/helpers";
import { ABBR_KEY, type Abbr } from "./lexeme/abbr";
import { ANIMACITY_KEY, type Animacy } from "./lexeme/animacy";
import { ASPECT_KEY, type Aspect } from "./lexeme/aspect";
import { CASE_KEY, type Case } from "./lexeme/case";
import { CLUSIVITY_KEY, type Clusivity } from "./lexeme/clusivity";
import { DEFINITE_KEY, type Definite } from "./lexeme/definite";
import { DEGREE_KEY, type Degree } from "./lexeme/degree";
import { DEIXIS_KEY, type Deixis } from "./lexeme/deixis";
import { DEIXIS_REF_KEY, type DeixisRef } from "./lexeme/deixis-ref";
import { EVIDENT_KEY, type Evident } from "./lexeme/evident";
import { EXT_POS_KEY, type ExtPos } from "./lexeme/ext-pos";
import { FOREIGN_KEY, type Foreign } from "./lexeme/foreign";
import { GENDER_KEY, type Gender } from "./lexeme/gender";
import { MOOD_KEY, type Mood } from "./lexeme/mood";
import {
	MORPHEME_KIND_KEY,
	type MorphemeKind,
} from "./morpheme/morpheme-kind";
import { NOUN_CLASS_KEY, type NounClass } from "./lexeme/noun-class";
import { NUM_TYPE_KEY, type NumType } from "./lexeme/num-type";
import { type GrammaticalNumber, NUMBER_KEY } from "./lexeme/number";
import { PERSON_KEY, type Person } from "./lexeme/person";
import { POLARITY_KEY, type Polarity } from "./lexeme/polarity";
import { POLITE_KEY, type Polite } from "./lexeme/polite";
import { POSS_KEY, type Poss } from "./lexeme/poss";
import { PRON_TYPE_KEY, type PronType } from "./lexeme/pron-type";
import {
	COLLOCATION_STRENGTH_KEY,
	type CollocationStrength,
} from "./phraseme/collocation-strength";
import {
	COLLOCATION_TYPE_KEY,
	type CollocationType,
} from "./phraseme/collocation-type";
import {
	DISCOURSE_FORMULA_ROLE_KEY,
	type DiscourseFormulaRole,
} from "./phraseme/discourse-formula-role";
import {
	PHRASEME_KIND_KEY,
	type PhrasemeKind,
} from "./phraseme/phraseme-kind";
import { REFLEX_KEY, type Reflex } from "./lexeme/reflex";
import { TENSE_KEY, type Tense } from "./lexeme/tense";
import { VERB_FORM_KEY, type VerbForm } from "./lexeme/verb-form";
import { VOICE_KEY, type Voice } from "./lexeme/voice";

export type AbstractLexemFeatures = Prettify<{
	[ABBR_KEY]?: Abbr;
	[ANIMACITY_KEY]?: Animacy;
	[ASPECT_KEY]?: Aspect;
	[CASE_KEY]?: Case;
	[CLUSIVITY_KEY]?: Clusivity;
	[DEFINITE_KEY]?: Definite;
	[DEGREE_KEY]?: Degree;
	[DEIXIS_KEY]?: Deixis;
	[DEIXIS_REF_KEY]?: DeixisRef;
	[EVIDENT_KEY]?: Evident;
	[EXT_POS_KEY]?: ExtPos;
	[FOREIGN_KEY]?: Foreign;
	[GENDER_KEY]?: Gender;
	[MOOD_KEY]?: Mood;
	[NOUN_CLASS_KEY]?: NounClass;
	[NUMBER_KEY]?: GrammaticalNumber;
	[NUM_TYPE_KEY]?: NumType;
	[PERSON_KEY]?: Person;
	[POLARITY_KEY]?: Polarity;
	[POLITE_KEY]?: Polite;
	[POSS_KEY]?: Poss;
	[PRON_TYPE_KEY]?: PronType;
	[REFLEX_KEY]?: Reflex;
	[TENSE_KEY]?: Tense;
	[VERB_FORM_KEY]?: VerbForm;
	[VOICE_KEY]?: Voice;
}>;

export type AbstractMorphemFeatures = Prettify<{
	[MORPHEME_KIND_KEY]?: MorphemeKind;
}>;

export type AbstractPhrasemFeatures = Prettify<{
	[COLLOCATION_STRENGTH_KEY]?: CollocationStrength;
	[COLLOCATION_TYPE_KEY]?: CollocationType;
	[DISCOURSE_FORMULA_ROLE_KEY]?: DiscourseFormulaRole;
	[PHRASEME_KIND_KEY]?: PhrasemeKind;
}>;
