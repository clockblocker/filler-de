import { z } from "zod";
import { GrundformSchema, WortartSchema, NomenSchema, GenusSchema, RegelmaessigkeitSchema, TrennbarkeitSchema, NomenDeklinationSchema, KasusSchema, PartizipVariantSchema, PartikelTypeSchema, AdverbCategorySchema, NumerusSchema, PronomenTypeSchema, MorphemSchema, morphemAnalysisOutputSchema, SteigerungsfaehigkeitSchema, VergleichsgradSchema } from "./schemas";

export type Grundform = z.infer<typeof GrundformSchema>;
export type Nomen = z.infer<typeof NomenSchema>;
export type Wortart = z.infer<typeof WortartSchema>;
export const Wortart = WortartSchema.Enum;

export type Genus = z.infer<typeof GenusSchema>;
export const Genus = GenusSchema.Enum;

export type Kasus = z.infer<typeof KasusSchema>;
export const Kasus = KasusSchema.Enum;

export type Regelmaessigkeit = z.infer<typeof RegelmaessigkeitSchema>;
export const Regelmaessigkeit = RegelmaessigkeitSchema.Enum;

export type Trennbarkeit = z.infer<typeof TrennbarkeitSchema>;
export const Trennbarkeit = TrennbarkeitSchema.Enum;

export type NomenDeklination = z.infer<typeof NomenDeklinationSchema>;
export const NomenDeklination = NomenDeklinationSchema.Enum;

export type PartizipVariant = z.infer<typeof PartizipVariantSchema>;
export const PartizipVariant = PartizipVariantSchema.Enum;

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
export type Steigerungsfaehigkeit = z.infer<typeof SteigerungsfaehigkeitSchema>;
export const Steigerungsfaehigkeit = SteigerungsfaehigkeitSchema.Enum;

export type Vergleichsgrad = z.infer<typeof VergleichsgradSchema>;
export const Vergleichsgrad = VergleichsgradSchema.Enum;

// ---

export const MatchStatusSchema = z.enum(['ExactMatch', 'Form', 'Misspelling']);
export const MatchStatus = MatchStatusSchema.Enum;
export type MatchStatus = z.infer<typeof MatchStatusSchema>;

export type GrundformWithMatchStatus = Grundform & { matchStatus: MatchStatus };

export type GrundformKerl = Pick<Grundform, "grundform" | "wortart">;

export type MorphemKerl = {grundform: string, morphem: Morphem};

export type MorphemAnalysisOutput = z.infer<typeof morphemAnalysisOutputSchema>;

// ---

export type Backlink = {path: string, tags?: string[]};
export type Block = {repr: string, backlinks: Backlink[]};