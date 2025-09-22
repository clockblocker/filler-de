import {
	Genus,
	Numerus,
	Kasus,
	NomenDeklination,
	Vergleichsgrad,
} from 'prompts/endgame/zod/types';
import { z } from 'zod';

const FormSchema = z.object({
	artikel: z.string(),
	agj: z.string(),
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
	CaseDeclensionSchema.shape
) as CaseDeclensionKeys[];

const DeclensionsSchema = z.object({
	[Kasus.N]: CaseDeclensionSchema,
	[Kasus.G]: CaseDeclensionSchema,
	[Kasus.D]: CaseDeclensionSchema,
	[Kasus.A]: CaseDeclensionSchema,
});
export type DeclensionsKeys = keyof z.infer<typeof DeclensionsSchema>;
export const declensionKeys = Object.keys(
	DeclensionsSchema.shape
) as DeclensionsKeys[];

export const AllDeclensionsSchema = z.object({
	[NomenDeklination.Stark]: DeclensionsSchema,
	[NomenDeklination.Schwach]: DeclensionsSchema.optional(),
	[NomenDeklination.Gemischt]: DeclensionsSchema.optional(),
});
export type AllDeclensionsKeys = keyof z.infer<typeof AllDeclensionsSchema>;
export const allDeclensionsKeys = Object.keys(
	AllDeclensionsSchema.shape
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
	AllDeclensionsFromGradSchema.shape
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
				[Genus.M]: [{ artikel: '', agj: `er` }],
				[Genus.N]: [{ artikel: '', agj: `es` }],
				[Genus.F]: [{ artikel: '', agj: `e` }],
				[Numerus.Mehrzahl]: [{ artikel: '', agj: `e` }],
			},
			[Kasus.G]: {
				[Genus.M]: [{ artikel: '', agj: `en` }],
				[Genus.N]: [{ artikel: '', agj: `en` }],
				[Genus.F]: [{ artikel: '', agj: `er` }],
				[Numerus.Mehrzahl]: [{ artikel: '', agj: `er` }],
			},
			[Kasus.D]: {
				[Genus.M]: [{ artikel: '', agj: `em` }],
				[Genus.N]: [{ artikel: '', agj: `em` }],
				[Genus.F]: [{ artikel: '', agj: `er` }],
				[Numerus.Mehrzahl]: [{ artikel: '', agj: `en` }],
			},
			[Kasus.A]: {
				[Genus.M]: [{ artikel: '', agj: `en` }],
				[Genus.N]: [{ artikel: '', agj: `es` }],
				[Genus.F]: [{ artikel: '', agj: `e` }],
				[Numerus.Mehrzahl]: [{ artikel: '', agj: `e` }],
			},
		},

		[NomenDeklination.Schwach]: {
			[Kasus.N]: {
				[Genus.M]: [{ artikel: 'der', agj: `e` }],
				[Genus.N]: [{ artikel: 'das', agj: `e` }],
				[Genus.F]: [{ artikel: 'die', agj: `e` }],
				[Numerus.Mehrzahl]: [{ artikel: 'die', agj: `en` }],
			},
			[Kasus.G]: {
				[Genus.M]: [{ artikel: 'des', agj: `en` }],
				[Genus.N]: [{ artikel: 'des', agj: `en` }],
				[Genus.F]: [{ artikel: 'der', agj: `en` }],
				[Numerus.Mehrzahl]: [{ artikel: 'der', agj: `en` }],
			},
			[Kasus.D]: {
				[Genus.M]: [{ artikel: 'dem', agj: `en` }],
				[Genus.N]: [{ artikel: 'dem', agj: `en` }],
				[Genus.F]: [{ artikel: 'der', agj: `en` }],
				[Numerus.Mehrzahl]: [{ artikel: 'den', agj: `en` }],
			},
			[Kasus.A]: {
				[Genus.M]: [{ artikel: 'den', agj: `en` }],
				[Genus.N]: [{ artikel: 'das', agj: `e` }],
				[Genus.F]: [{ artikel: 'die', agj: `e` }],
				[Numerus.Mehrzahl]: [{ artikel: 'die', agj: `en` }],
			},
		},

		[NomenDeklination.Gemischt]: {
			[Kasus.N]: {
				[Genus.M]: [{ artikel: 'ein', agj: `er` }],
				[Genus.N]: [{ artikel: 'ein', agj: `es` }],
				[Genus.F]: [{ artikel: 'eine', agj: `e` }],
				[Numerus.Mehrzahl]: [{ artikel: 'keine', agj: `en` }],
			},
			[Kasus.G]: {
				[Genus.M]: [{ artikel: 'eines', agj: `en` }],
				[Genus.N]: [{ artikel: 'eines', agj: `en` }],
				[Genus.F]: [{ artikel: 'einer', agj: `en` }],
				[Numerus.Mehrzahl]: [{ artikel: 'keiner', agj: `en` }],
			},
			[Kasus.D]: {
				[Genus.M]: [{ artikel: 'einem', agj: `en` }],
				[Genus.N]: [{ artikel: 'einem', agj: `en` }],
				[Genus.F]: [{ artikel: 'einer', agj: `en` }],
				[Numerus.Mehrzahl]: [{ artikel: 'keinen', agj: `en` }],
			},
			[Kasus.A]: {
				[Genus.M]: [{ artikel: 'einen', agj: `en` }],
				[Genus.N]: [{ artikel: 'ein', agj: `es` }],
				[Genus.F]: [{ artikel: 'eine', agj: `e` }],
				[Numerus.Mehrzahl]: [{ artikel: 'keine', agj: `en` }],
			},
		},
	};

export const nouns: Record<keyof CaseDeclension, string[]> = {
	[Genus.M]: ['Vater', 'Sohn', 'Ding', 'Onkel'],
	[Genus.F]: ['Mutter', 'Tochter', 'Sache', 'Tante'],
	[Genus.N]: ['Kind', 'Baby', 'Geschenk', 'Mädchen'],
	[Numerus.Mehrzahl]: ['Väter', 'Töchter', 'Geschenke', 'Mutter'],
};

export const pronomen: Record<keyof CaseDeclension, string[]> = {
	[Genus.M]: ['er', 'ihm', 'ihn', 'seines'],
	[Genus.F]: ['sie', 'ihr', 'sie', 'ihrer'],
	[Genus.N]: ['es', 'ihm', 'es', 'ihres'],
	[Numerus.Mehrzahl]: ['sie', 'ihnen', 'sie', 'ihrer'],
};

export const verbForms: Record<keyof CaseDeclension, string> = {
	[Genus.M]: 'gibt',
	[Genus.F]: 'gibt',
	[Genus.N]: 'gibt',
	[Numerus.Mehrzahl]: 'geben',
};
