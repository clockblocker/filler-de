import { z } from 'zod';
import {
	GrundformSchema,
	WortartSchema,
	NomenGrundformSchema,
	GenusSchema,
	RegelmaessigSchema,
	TrennbarkeitSchema,
	NomenDeklinationSchema,
	KasusSchema,
	PartikelTypeSchema,
	AdverbCategorySchema,
	NumerusSchema,
	PronomenTypeSchema,
	MorphemSchema,
	morphemAnalysisOutputSchema,
	SteigerungsfaehigSchema,
	VergleichsgradSchema,
	MatchSchema,
	grundformsOutputSchema,
	adjektivOutputSchema,
} from './schemas';

export type Grundform = z.infer<typeof GrundformSchema>;
export type Nomen = z.infer<typeof NomenGrundformSchema>;
export type Wortart = z.infer<typeof WortartSchema>;
export const Wortart = WortartSchema.Enum;

// Genus, Kasus, NomenDeklination, Numerus
export type Genus = z.infer<typeof GenusSchema>;
export const Genus = GenusSchema.Enum;

export type Kasus = z.infer<typeof KasusSchema>;
export const Kasus = KasusSchema.Enum;

export type Regelmaessigkeit = z.infer<typeof RegelmaessigSchema>;

export type Trennbarkeit = z.infer<typeof TrennbarkeitSchema>;
export const Trennbarkeit = TrennbarkeitSchema.Enum;

export type NomenDeklination = z.infer<typeof NomenDeklinationSchema>;
export const NomenDeklination = NomenDeklinationSchema.Enum;

export type PartikelType = z.infer<typeof PartikelTypeSchema>;
export const PartikelType = PartikelTypeSchema.Enum;

export type AdverbCategory = z.infer<typeof AdverbCategorySchema>;
export const AdverbCategory = AdverbCategorySchema.Enum;

export type Numerus = z.infer<typeof NumerusSchema>;
export const Numerus = NumerusSchema.Enum;

export type PronomenType = z.infer<typeof PronomenTypeSchema>;
export const PronomenType = PronomenTypeSchema.Enum;

export type Morphem = z.infer<typeof MorphemSchema>;
export const Morphem = MorphemSchema.Enum;

// ---
export type Steigerungsfaehigkeit = z.infer<typeof SteigerungsfaehigSchema>;

export type Vergleichsgrad = z.infer<typeof VergleichsgradSchema>;
export const Vergleichsgrad = VergleichsgradSchema.Enum;

// ---

export type GrundformsOutput = z.infer<typeof grundformsOutputSchema>;

export const Match = MatchSchema.Enum;
export type Match = z.infer<typeof MatchSchema>;

export type GrundformWithMatch = Grundform & { match: Match };

export type GrundformKerl = Pick<Grundform, 'grundform' | 'wortart'>;

export type MorphemKerl = { grundform: string; morphem: Morphem };

export type MorphemAnalysisOutput = z.infer<typeof morphemAnalysisOutputSchema>;

// ---

export type Backlink = { path: string; tags?: string[] };
export type Block = { repr: string; backlinks: Backlink[] };

// ---
export type AdjektivOutput = z.infer<typeof adjektivOutputSchema>;
