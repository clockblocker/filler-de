import type * as z from "zod/v3";

import type { Prettify } from "../../../../../../../../types/helpers";
import { DiscourseFormulaRoleSchema } from "./custom/discourse-formula-role";
import { GovernedCase } from "./custom/governed-case";
import { GovernedPreposition } from "./custom/governed-preposition";
import { LexicallyReflexive } from "./custom/lexically-reflexive";
import { Phrasal } from "./custom/phrasal";
import { Separable } from "./custom/separable";
import { Abbr } from "./ud/abbr";
import { AdpType } from "./ud/adp-type";
import { Animacy } from "./ud/animacy";
import { Aspect } from "./ud/aspect";
import { Case } from "./ud/case";
import { Clusivity } from "./ud/clusivity";
import { ConjType } from "./ud/conj-type";
import { Definite } from "./ud/definite";
import { Degree } from "./ud/degree";
import { Deixis } from "./ud/deixis";
import { DeixisRef } from "./ud/deixis-ref";
import { Evident } from "./ud/evident";
import { ExtPos } from "./ud/ext-pos";
import { Foreign } from "./ud/foreign";
import { Gender } from "./ud/gender";
import { Hyph } from "./ud/hyph";
import { Mood } from "./ud/mood";
import { NounClass } from "./ud/noun-class";
import { NumForm } from "./ud/num-form";
import { NumType } from "./ud/num-type";
import { GrammaticalNumber } from "./ud/number";
import { PartType } from "./ud/part-type";
import { Person } from "./ud/person";
import { Polarity } from "./ud/polarity";
import { Polite } from "./ud/polite";
import { Poss } from "./ud/poss";
import { PronType } from "./ud/pron-type";
import { PunctType } from "./ud/punct-type";
import { Reflex } from "./ud/reflex";
import { Style } from "./ud/style";
import { Tense } from "./ud/tense";
import { Variant } from "./ud/variant";
import { VerbForm } from "./ud/verb-form";
import { VerbType } from "./ud/verb-type";
import { Voice } from "./ud/voice";

export const UniversalFeature = {
	Abbr,
	AdpType,
	Animacy,
	Aspect,
	Case,
	Clusivity,
	ConjType,
	Definite,
	Degree,
	Deixis,
	DeixisRef,
	DiscourseFormulaRole: DiscourseFormulaRoleSchema,
	Evident,
	ExtPos,
	Foreign,
	Gender,
	GovernedCase,
	GovernedPreposition,
	GrammaticalNumber,
	Hyph,
	LexicallyReflexive,
	Mood,
	NounClass,
	NumForm,
	NumType,
	PartType,
	Person,
	Phrasal,
	Polarity,
	Polite,
	Poss,
	PronType,
	PunctType,
	Reflex,
	Separable,
	Style,
	Tense,
	// Typo is exluded from the list of features, because in this system, Selections are responsible forhandeling typos
	Variant,
	VerbForm,
	VerbType,
	Voice,
} as const;

export type UniversalFeatureKey = keyof typeof UniversalFeature;

export type UniversalFeatureValue<
	K extends UniversalFeatureKey = UniversalFeatureKey,
> = z.infer<(typeof UniversalFeature)[K]>;

export type FeatureValueSet<T> = T | readonly [T, ...T[]];

export type AbstractFeatures = Prettify<{
	adpType: UniversalFeatureValue<"AdpType">;
	abbr: UniversalFeatureValue<"Abbr">;
	animacy: UniversalFeatureValue<"Animacy">;
	aspect: UniversalFeatureValue<"Aspect">;
	case: UniversalFeatureValue<"Case">;
	clusivity: UniversalFeatureValue<"Clusivity">;
	conjType: UniversalFeatureValue<"ConjType">;
	definite: UniversalFeatureValue<"Definite">;
	degree: UniversalFeatureValue<"Degree">;
	deixis: UniversalFeatureValue<"Deixis">;
	deixisRef: UniversalFeatureValue<"DeixisRef">;
	evident: UniversalFeatureValue<"Evident">;
	extPos: UniversalFeatureValue<"ExtPos">;
	foreign: UniversalFeatureValue<"Foreign">;
	gender: FeatureValueSet<UniversalFeatureValue<"Gender">>;
	"gender[psor]": FeatureValueSet<UniversalFeatureValue<"Gender">>;
	governedCase: UniversalFeatureValue<"GovernedCase">;
	governedPreposition: UniversalFeatureValue<"GovernedPreposition">;
	hyph: UniversalFeatureValue<"Hyph">;
	lexicallyReflexive: UniversalFeatureValue<"LexicallyReflexive">;
	phrasal: UniversalFeatureValue<"Phrasal">;
	mood: UniversalFeatureValue<"Mood">;
	nounClass: UniversalFeatureValue<"NounClass">;
	numForm: UniversalFeatureValue<"NumForm">;
	number: UniversalFeatureValue<"GrammaticalNumber">;
	"number[psor]": UniversalFeatureValue<"GrammaticalNumber">;
	numType: UniversalFeatureValue<"NumType">;
	partType: UniversalFeatureValue<"PartType">;
	person: UniversalFeatureValue<"Person">;
	polarity: UniversalFeatureValue<"Polarity">;
	polite: UniversalFeatureValue<"Polite">;
	poss: UniversalFeatureValue<"Poss">;
	pronType: FeatureValueSet<UniversalFeatureValue<"PronType">>;
	punctType: UniversalFeatureValue<"PunctType">;
	reflex: UniversalFeatureValue<"Reflex">;
	style: UniversalFeatureValue<"Style">;
	tense: UniversalFeatureValue<"Tense">;
	variant: UniversalFeatureValue<"Variant">;
	verbForm: UniversalFeatureValue<"VerbForm">;
	verbType: UniversalFeatureValue<"VerbType">;
	voice: UniversalFeatureValue<"Voice">;
	separable: UniversalFeatureValue<"Separable">;
}>;
