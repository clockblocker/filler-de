import type * as z from "zod/v3";

import type { Prettify } from "../../../../../../../../types/helpers";
import { DiscourseFormulaRoleSchema } from "./custom/discourse-formula-role";
import { GovernedPreposition } from "./custom/governed-preposition";
import { IsPhrasal } from "./custom/is-phrasal";
import { IsSeparable } from "./custom/separable";
import { IsAbbr } from "./ud/abbr";
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
import { IsForeign } from "./ud/foreign";
import { Gender } from "./ud/gender";
import { Mood } from "./ud/mood";
import { NounClass } from "./ud/noun-class";
import { NumType } from "./ud/num-type";
import { GrammaticalNumber } from "./ud/number";
import { Person } from "./ud/person";
import { Polarity } from "./ud/polarity";
import { Polite } from "./ud/polite";
import { IsPoss } from "./ud/poss";
import { PronType } from "./ud/pron-type";
import { IsReflex } from "./ud/reflex";
import { Tense } from "./ud/tense";
import { VerbForm } from "./ud/verb-form";
import { Voice } from "./ud/voice";

export const UniversalFeature = {
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
	Gender,
	GovernedPreposition,
	GrammaticalNumber,
	IsAbbr,
	IsForeign,
	IsPhrasal,
	IsPoss,
	IsReflex,
	IsSeparable,
	Mood,
	NounClass,
	NumType,
	Person,
	Polarity,
	Polite,
	PronType,
	Tense,
	VerbForm,
	Voice,
} as const;

export type UniversalFeatureKey = keyof typeof UniversalFeature;

export type UniversalFeatureValue<
	K extends UniversalFeatureKey = UniversalFeatureKey,
> = z.infer<(typeof UniversalFeature)[K]>;

export type AbstractFeatures = Prettify<{
	abbr: UniversalFeatureValue<"IsAbbr">;
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
	foreign: UniversalFeatureValue<"IsForeign">;
	gender: UniversalFeatureValue<"Gender">;
	governedPreposition: UniversalFeatureValue<"GovernedPreposition">;
	isPhrasal: UniversalFeatureValue<"IsPhrasal">;
	mood: UniversalFeatureValue<"Mood">;
	nounClass: UniversalFeatureValue<"NounClass">;
	number: UniversalFeatureValue<"GrammaticalNumber">;
	numType: UniversalFeatureValue<"NumType">;
	person: UniversalFeatureValue<"Person">;
	polarity: UniversalFeatureValue<"Polarity">;
	polite: UniversalFeatureValue<"Polite">;
	poss: UniversalFeatureValue<"IsPoss">;
	pronType: UniversalFeatureValue<"PronType">;
	reflex: UniversalFeatureValue<"IsReflex">;
	tense: UniversalFeatureValue<"Tense">;
	verbForm: UniversalFeatureValue<"VerbForm">;
	voice: UniversalFeatureValue<"Voice">;
	separable: UniversalFeatureValue<"IsSeparable">;
}>;
