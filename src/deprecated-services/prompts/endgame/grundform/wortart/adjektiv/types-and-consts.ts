import { z } from "zod";
import {
	Genus,
	Kasus,
	NomenDeklination,
	Numerus,
	Vergleichsgrad,
} from "../../../zod/types";

const FormSchema = z.object({
	agj: z.string(),
	artikel: z.string(),
});

const FormsSchema = FormSchema.array();

const CaseDeclensionSchema = z.object({
	[Genus.M]: FormsSchema,
	[Genus.N]: FormsSchema,
	[Genus.F]: FormsSchema,
	[Numerus.Mehrzahl]: FormsSchema,
});
export type CaseDeclensionKeys = keyof z.infer<typeof CaseDeclensionSchema>;
export const caseDeclensionKeys = Object.keys(
	CaseDeclensionSchema.shape,
) as CaseDeclensionKeys[];

const DeclensionsSchema = z.object({
	[Kasus.N]: CaseDeclensionSchema,
	[Kasus.G]: CaseDeclensionSchema,
	[Kasus.D]: CaseDeclensionSchema,
	[Kasus.A]: CaseDeclensionSchema,
});
export type DeclensionsKeys = keyof z.infer<typeof DeclensionsSchema>;
export const declensionKeys = Object.keys(
	DeclensionsSchema.shape,
) as DeclensionsKeys[];

export const AllDeclensionsSchema = z.object({
	[NomenDeklination.Stark]: DeclensionsSchema,
	[NomenDeklination.Schwach]: DeclensionsSchema.optional(),
	[NomenDeklination.Gemischt]: DeclensionsSchema.optional(),
});
export type AllDeclensionsKeys = keyof z.infer<typeof AllDeclensionsSchema>;
export const allDeclensionsKeys = Object.keys(
	AllDeclensionsSchema.shape,
) as AllDeclensionsKeys[];

export const AllDeclensionsFromGradSchema = z.object({
	[Vergleichsgrad.Positiv]: AllDeclensionsSchema,
	[Vergleichsgrad.Komparativ]: AllDeclensionsSchema,
	[Vergleichsgrad.Superlativ]: AllDeclensionsSchema,
});
export type AllDeclensionsFromGradKeys = keyof z.infer<
	typeof AllDeclensionsFromGradSchema
>;
export const allDeclensionsFromGradKeys = Object.keys(
	AllDeclensionsFromGradSchema.shape,
) as AllDeclensionsFromGradKeys[];

const PathFromWortSchema = z.record(z.string(), z.string());
export const PathFromWortFromGradSchema = z.object({
	[Vergleichsgrad.Positiv]: PathFromWortSchema,
	[Vergleichsgrad.Komparativ]: PathFromWortSchema.optional(),
	[Vergleichsgrad.Superlativ]: PathFromWortSchema.optional(),
});

export type Declensions = z.infer<typeof DeclensionsSchema>;
export type CaseDeclension = z.infer<typeof CaseDeclensionSchema>;
export type AllDeclensions = z.infer<typeof AllDeclensionsSchema>;
export type AllDeclensionsFromGrad = z.infer<
	typeof AllDeclensionsFromGradSchema
>;
export type PathFromWortFromGrad = z.infer<typeof PathFromWortFromGradSchema>;
export type PathFromWort = z.infer<typeof PathFromWortSchema>;

export const fromFromNomenDeklinationFromKasusFromCaseDeclension: AllDeclensions =
	{
		[NomenDeklination.Stark]: {
			[Kasus.N]: {
				[Genus.M]: [{ agj: "er", artikel: "" }],
				[Genus.N]: [{ agj: "es", artikel: "" }],
				[Genus.F]: [{ agj: "e", artikel: "" }],
				[Numerus.Mehrzahl]: [{ agj: "e", artikel: "" }],
			},
			[Kasus.G]: {
				[Genus.M]: [{ agj: "en", artikel: "" }],
				[Genus.N]: [{ agj: "en", artikel: "" }],
				[Genus.F]: [{ agj: "er", artikel: "" }],
				[Numerus.Mehrzahl]: [{ agj: "er", artikel: "" }],
			},
			[Kasus.D]: {
				[Genus.M]: [{ agj: "em", artikel: "" }],
				[Genus.N]: [{ agj: "em", artikel: "" }],
				[Genus.F]: [{ agj: "er", artikel: "" }],
				[Numerus.Mehrzahl]: [{ agj: "en", artikel: "" }],
			},
			[Kasus.A]: {
				[Genus.M]: [{ agj: "en", artikel: "" }],
				[Genus.N]: [{ agj: "es", artikel: "" }],
				[Genus.F]: [{ agj: "e", artikel: "" }],
				[Numerus.Mehrzahl]: [{ agj: "e", artikel: "" }],
			},
		},

		[NomenDeklination.Schwach]: {
			[Kasus.N]: {
				[Genus.M]: [{ agj: "e", artikel: "der" }],
				[Genus.N]: [{ agj: "e", artikel: "das" }],
				[Genus.F]: [{ agj: "e", artikel: "die" }],
				[Numerus.Mehrzahl]: [{ agj: "en", artikel: "die" }],
			},
			[Kasus.G]: {
				[Genus.M]: [{ agj: "en", artikel: "des" }],
				[Genus.N]: [{ agj: "en", artikel: "des" }],
				[Genus.F]: [{ agj: "en", artikel: "der" }],
				[Numerus.Mehrzahl]: [{ agj: "en", artikel: "der" }],
			},
			[Kasus.D]: {
				[Genus.M]: [{ agj: "en", artikel: "dem" }],
				[Genus.N]: [{ agj: "en", artikel: "dem" }],
				[Genus.F]: [{ agj: "en", artikel: "der" }],
				[Numerus.Mehrzahl]: [{ agj: "en", artikel: "den" }],
			},
			[Kasus.A]: {
				[Genus.M]: [{ agj: "en", artikel: "den" }],
				[Genus.N]: [{ agj: "e", artikel: "das" }],
				[Genus.F]: [{ agj: "e", artikel: "die" }],
				[Numerus.Mehrzahl]: [{ agj: "en", artikel: "die" }],
			},
		},

		[NomenDeklination.Gemischt]: {
			[Kasus.N]: {
				[Genus.M]: [{ agj: "er", artikel: "ein" }],
				[Genus.N]: [{ agj: "es", artikel: "ein" }],
				[Genus.F]: [{ agj: "e", artikel: "eine" }],
				[Numerus.Mehrzahl]: [{ agj: "en", artikel: "keine" }],
			},
			[Kasus.G]: {
				[Genus.M]: [{ agj: "en", artikel: "eines" }],
				[Genus.N]: [{ agj: "en", artikel: "eines" }],
				[Genus.F]: [{ agj: "en", artikel: "einer" }],
				[Numerus.Mehrzahl]: [{ agj: "en", artikel: "keiner" }],
			},
			[Kasus.D]: {
				[Genus.M]: [{ agj: "en", artikel: "einem" }],
				[Genus.N]: [{ agj: "en", artikel: "einem" }],
				[Genus.F]: [{ agj: "en", artikel: "einer" }],
				[Numerus.Mehrzahl]: [{ agj: "en", artikel: "keinen" }],
			},
			[Kasus.A]: {
				[Genus.M]: [{ agj: "en", artikel: "einen" }],
				[Genus.N]: [{ agj: "es", artikel: "ein" }],
				[Genus.F]: [{ agj: "e", artikel: "eine" }],
				[Numerus.Mehrzahl]: [{ agj: "en", artikel: "keine" }],
			},
		},
	};

export const nouns: Record<keyof CaseDeclension, string[]> = {
	[Genus.M]: ["Vater", "Sohn", "Ding", "Onkel"],
	[Genus.F]: ["Mutter", "Tochter", "Sache", "Tante"],
	[Genus.N]: ["Kind", "Baby", "Geschenk", "Mädchen"],
	[Numerus.Mehrzahl]: ["Väter", "Töchter", "Geschenke", "Mutter"],
};

export const pronomen: Record<keyof CaseDeclension, string[]> = {
	[Genus.M]: ["er", "ihm", "ihn", "seines"],
	[Genus.F]: ["sie", "ihr", "sie", "ihrer"],
	[Genus.N]: ["es", "ihm", "es", "ihres"],
	[Numerus.Mehrzahl]: ["sie", "ihnen", "sie", "ihrer"],
};

export const verbForms: Record<keyof CaseDeclension, string> = {
	[Genus.M]: "gibt",
	[Genus.F]: "gibt",
	[Genus.N]: "gibt",
	[Numerus.Mehrzahl]: "geben",
};
