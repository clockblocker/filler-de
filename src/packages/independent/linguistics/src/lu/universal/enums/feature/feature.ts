import type * as z from "zod/v3";

import type { Prettify } from "../../../../../../../../types/helpers";
import { DiscourseFormulaRoleSchema } from "./custom/discourse-formula-role";
import { GovernedCase } from "./custom/governed-case";
import { GovernedPreposition } from "./custom/governed-preposition";
import { LexicallyReflexive } from "./custom/lexically-reflexive";
import { Phrasal } from "./custom/phrasal";
import { Separable } from "./custom/separable";
import { Abbr } from "./ud/abbr";
import { Animacy } from "./ud/animacy";
import { Aspect } from "./ud/aspect";
import { Case } from "./ud/case";
import { Clusivity } from "./ud/clusivity";
import { Definite } from "./ud/definite";
import { Degree } from "./ud/degree";
import { Deixis } from "./ud/deixis";
import { DeixisRef } from "./ud/deixis-ref";
import { Evident } from "./ud/evident";
import { ExtPos } from "./ud/ext-pos";
import { Foreign } from "./ud/foreign";
import { Gender } from "./ud/gender";
import { Mood } from "./ud/mood";
import { NounClass } from "./ud/noun-class";
import { NumForm } from "./ud/num-form";
import { NumType } from "./ud/num-type";
import { GrammaticalNumber } from "./ud/number";
import { Person } from "./ud/person";
import { Polarity } from "./ud/polarity";
import { Polite } from "./ud/polite";
import { Poss } from "./ud/poss";
import { PronType } from "./ud/pron-type";
import { Reflex } from "./ud/reflex";
import { Style } from "./ud/style";
import { Tense } from "./ud/tense";
import { VerbForm } from "./ud/verb-form";
import { Voice } from "./ud/voice";

export const UniversalFeature = {
	Abbr,
	Animacy,
	Aspect,
	Case,
	Clusivity,
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
	LexicallyReflexive,
	Mood,
	NounClass,
	NumForm,
	NumType,
	Person,
	Phrasal,
	Polarity,
	Polite,
	Poss,
	PronType,
	Reflex,
	Separable,
	Style,
	Tense,
	// Typo is exluded from the list of features, because in this system, Selections are responsible forhandeling typos
	VerbForm,
	Voice,
} as const;

export type UniversalFeatureKey = keyof typeof UniversalFeature;

export type UniversalFeatureValue<
	K extends UniversalFeatureKey = UniversalFeatureKey,
> = z.infer<(typeof UniversalFeature)[K]>;

export type AbstractFeatures = Prettify<{
	abbr: UniversalFeatureValue<"Abbr">;
	animacy: UniversalFeatureValue<"Animacy">;
	aspect: UniversalFeatureValue<"Aspect">;
	case: UniversalFeatureValue<"Case">;
	clusivity: UniversalFeatureValue<"Clusivity">;
	definite: UniversalFeatureValue<"Definite">;
	degree: UniversalFeatureValue<"Degree">;
	deixis: UniversalFeatureValue<"Deixis">;
	deixisRef: UniversalFeatureValue<"DeixisRef">;
	evident: UniversalFeatureValue<"Evident">;
	extPos: UniversalFeatureValue<"ExtPos">;
	foreign: UniversalFeatureValue<"Foreign">;
	gender: UniversalFeatureValue<"Gender">;
	governedCase: UniversalFeatureValue<"GovernedCase">;
	governedPreposition: UniversalFeatureValue<"GovernedPreposition">;
	lexicallyReflexive: UniversalFeatureValue<"LexicallyReflexive">;
	phrasal: UniversalFeatureValue<"Phrasal">;
	mood: UniversalFeatureValue<"Mood">;
	nounClass: UniversalFeatureValue<"NounClass">;
	numForm: UniversalFeatureValue<"NumForm">;
	number: UniversalFeatureValue<"GrammaticalNumber">;
	numType: UniversalFeatureValue<"NumType">;
	person: UniversalFeatureValue<"Person">;
	polarity: UniversalFeatureValue<"Polarity">;
	polite: UniversalFeatureValue<"Polite">;
	poss: UniversalFeatureValue<"Poss">;
	pronType: UniversalFeatureValue<"PronType">;
	reflex: UniversalFeatureValue<"Reflex">;
	style: UniversalFeatureValue<"Style">;
	tense: UniversalFeatureValue<"Tense">;
	verbForm: UniversalFeatureValue<"VerbForm">;
	voice: UniversalFeatureValue<"Voice">;
	separable: UniversalFeatureValue<"Separable">;
}>;
