// import { z } from "zod";

// const VergleichsformSchema = z.enum(["Positiv", "Komparativ", "Superlativ"]);
// const VerbFormTagSchema = z.enum(["Praesens", "Praeteritum", "Perfekt", "Imperativ", "K1", "K2", "P1", "P2", "ZuInfinitiv"]);

// const FormSchema = z.enum(["Grundform", "Flektiert"]);
// const MatchSchema = z.enum(["Grundform", "Flexion", "Tippfehler"]);

// const ConjugationSchema = z.enum(["Stark", "Schwach", "Gemischt"]);
// const AdjektivDeklinationSchema = z.enum(["Stark", "Schwach", "Gemischt"]);

// // ---

// const KasusSchema = z.enum(["N", "G", "D", "A"]); // ["Nominativ", "Genitiv", "Dativ", "Akkusativ"]
// const GenusSchema = z.enum(["F", "M", "N"]); // ["Feminin", "Maskulin", "Neutrum"]
// const NumerusSchema = z.enum(["Einzahl", "Mehrzahl"]);

// const NomenDeklinationSchema = z.enum(["Stark", "Schwach", "Gemischt"]);
// const RegelmaessigSchema = z.boolean(); // "Regelmaessig", "Unregelmaessig"

// const TrennbarkeitSchema = z.enum(["Trennbar", "Untrennbar"]);

// const AdverbCategorySchema = z.enum(["Lokal", "Temporal", "Modal", "Kausal", "Grad"]);
// const ArtikelTypeSchema = z.enum(["Bestimmt", "Unbestimmt"]);
// const PartikelTypeSchema = z.enum(["Intensität", "Fokus", "Negation", "Abtönung", "Konnektiv"]);
// const NumeraleTypeSchema = z.enum(["Grundzahl", "Ordnungszahl", "Bruchzahl", "Multiplikativ", "Kollektiv"]);
// const KonjunktionTypeSchema = z.enum(["Koordinierend", "Subordinierend"]);

// const PronomenTypeSchema = z.enum([
//   "Possessiv",
//   "Reflexiv",
//   "Personal",
//   "Generalisierendes",
//   "Demonstrativ",
//   "W-Pronomen",
//   "Indefinit",
//   "Quantifikativ",
// ]);

// const CommonGrundformsFeildsSchema = z.object({
//     grundform: z.string(),
//     match: MatchSchema,
//     emojiBeschreibungs: z.array(z.string().emoji()), // Describe the common meanings with emojies; Up to 3 emojies per meaning. Aim for less, if possible
// });

// const WortartSchema = z.enum([
//   "Nomen",
//   "Pronomen",
//   "Verb",
//   "Adjektiv",
//   "Adverb",
//   "Artikel",
//   "Partikel",
//   "Praeposition",
//   "Konjunktion",
//   "Numerale",
//   "Praefix",
//   "Redewendung",
//   "Interjektion",
//   "Unbekannt"
// ]);

// const GoverningPrepositionSchema = z.enum([
//   "an", "auf", "bei", "bis", "durch", "für", "gegen", "in", "mit", "nach",
//   "ohne", "um", "unter", "von", "vor", "während", "wegen", "trotz", "innerhalb",
//   "außerhalb", "entlang", "mithilfe", "seit", "über", "als"
// ]);

// const NomenGrundformSchema = z.object({
//   wortart: z.literal(WortartSchema.enum.Nomen),
//   genus: GenusSchema,
//   deklination: NomenDeklinationSchema,
//   eigenname: z.optional(z.boolean()),
//   ...CommonGrundformsFeildsSchema.shape,
// });

// const PronomenGrundformSchema = z.object({
//   wortart: z.literal(WortartSchema.enum.Pronomen),
//   pronomenType: PronomenTypeSchema,
//   number: z.optional(z.array(NumerusSchema)),
//   genera: z.optional(z.array(GenusSchema)),
//   ...CommonGrundformsFeildsSchema.shape,
// });

// const VerbGrundformSchema = z.object({
//   wortart: z.literal(WortartSchema.enum.Verb),
//   trennbarkeit: z.optional(TrennbarkeitSchema),
//   regelmaessig: RegelmaessigSchema,
//   ...CommonGrundformsFeildsSchema.shape,
// });

// const AdjektivGrundformSchema = z.object({
//   wortart: z.literal(WortartSchema.enum.Adjektiv),
//   ...CommonGrundformsFeildsSchema.shape,
// });

// const AdverbGrundformSchema = z.object({
//   wortart: z.literal(WortartSchema.enum.Adverb),
//   adverbCategory: z.array(AdverbCategorySchema),
//   ...CommonGrundformsFeildsSchema.shape,
// });

// const ArtikelGrundformSchema = z.object({
//   wortart: z.literal(WortartSchema.enum.Artikel),
//   artikelType: ArtikelTypeSchema,
//   ...CommonGrundformsFeildsSchema.shape,
// });

// const PartikelGrundformSchema = z.object({
//   wortart: z.literal(WortartSchema.enum.Partikel),
//   partikelType: z.array(PartikelTypeSchema),
//   ...CommonGrundformsFeildsSchema.shape,
// });

// const KonjunktionGrundformSchema = z.object({
//   wortart: z.literal(WortartSchema.enum.Konjunktion),
//   konjunktionType: KonjunktionTypeSchema,
//   ...CommonGrundformsFeildsSchema.shape,
// });

// const PraepositionGrundformSchema = z.object({
//   wortart: z.literal(WortartSchema.enum.Praeposition),
//   possibleGoverningKasuss: z.optional(z.array(KasusSchema)),
//   ...CommonGrundformsFeildsSchema.shape,
// });

// const NumeraleGrundformSchema = z.object({
//   wortart: z.literal(WortartSchema.enum.Numerale),
//   ...CommonGrundformsFeildsSchema.shape,
// });

// const PraefixGrundformSchema = z.object({
//   wortart: z.literal(WortartSchema.enum.Praefix),
//   ...CommonGrundformsFeildsSchema.shape,
// });

// const InterjektionGrundformSchema = z.object({
//   wortart: z.literal(WortartSchema.enum.Interjektion),
//   ...CommonGrundformsFeildsSchema.shape,
// });

// const RedewendungGrundformSchema = z.object({
//     wortart: z.literal(WortartSchema.enum.Redewendung),
//     ...CommonGrundformsFeildsSchema.shape,
// });

// const UnbekanntGrundformSchema = z.object({
//     wortart: z.literal(WortartSchema.enum.Unbekannt),
//     comment: z.string(),
//     ...CommonGrundformsFeildsSchema.shape,
// });

// const GrundformSchema = z.discriminatedUnion("wortart", [
//   NomenGrundformSchema,
//   PronomenGrundformSchema,
//   VerbGrundformSchema,
//   AdjektivGrundformSchema,
//   AdverbGrundformSchema,
//   ArtikelGrundformSchema,
//   PartikelGrundformSchema,
//   KonjunktionGrundformSchema,
//   PraepositionGrundformSchema,
//   NumeraleGrundformSchema,
//   PraefixGrundformSchema,
//   InterjektionGrundformSchema,
//   RedewendungGrundformSchema,
//   UnbekanntGrundformSchema,
// ]);

// const grundformsOutputSchema = z.array(GrundformSchema);

// // ---

// const MorphemSchema = z.enum([
//   "Zirkumfix",
//   "Konversion",
//   "Praefix",
//   "Suffix",
//   "Stamm",
//   "Endung",
//   "Fugenelement"
// ]);

// const morphemAnalysisOutputSchema = z.object({
//   "morphemischeZerlegung": z.array(z.record(z.string(), MorphemSchema)),
//   "zusammengesetztAus": z.optional(z.array(z.record(z.string(), WortartSchema)),),
// });

// const SteigerungsfaehigSchema = z.boolean(); // "Steigerungsfaehig", "Unsteigerungsfaehig"
// const VergleichsgradSchema = z.enum(["Positiv", "Komparativ", "Superlativ"]);

// const AdjektivOutputSchema = z.array(z.object({
//   "adjektivstamm": z.object({
//     [VergleichsgradSchema.enum.Positiv]: z.string(),
//     [VergleichsgradSchema.enum.Komparativ]: z.string().optional(),
//     [VergleichsgradSchema.enum.Superlativ]: z.string().optional(),
//   }),
//   "regelmaessig": RegelmaessigSchema,
//   "steigerungsfaehig": SteigerungsfaehigSchema,
// }));

// export {
//   SteigerungsfaehigSchema,
//   VergleichsgradSchema,
//   grundformsOutputSchema,
//   GenusSchema,
//   KasusSchema,
//   WortartSchema,
//   NomenGrundformSchema as NomenSchema,
//   PronomenTypeSchema,
//   NumerusSchema,
//   PronomenGrundformSchema as PronomenSchema,
//   TrennbarkeitSchema,
//   GoverningPrepositionSchema,
//   VerbGrundformSchema as VerbSchema,
//   AdjektivGrundformSchema as AdjektivSchema,
//   AdverbCategorySchema,
//   AdverbGrundformSchema as AdverbSchema,
//   ArtikelTypeSchema,
//   ArtikelGrundformSchema as ArtikelSchema,
//   PartikelTypeSchema,
//   PartikelGrundformSchema as PartikelSchema,
//   KonjunktionTypeSchema,
//   KonjunktionGrundformSchema as KonjunktionSchema,
//   PraepositionGrundformSchema as PraepositionSchema,
//   NumeraleTypeSchema,
//   NumeraleGrundformSchema as NumeraleSchema,
//   PraefixGrundformSchema as PraefixSchema,
//   InterjektionGrundformSchema as InterjektionSchema,
//   GrundformSchema,
//   RedewendungGrundformSchema as RedewendungSchema,
//   VergleichsformSchema,
//   VerbFormTagSchema,
//   FormSchema,
//   RegelmaessigSchema,
//   ConjugationSchema,
//   AdjektivDeklinationSchema,
//   NomenDeklinationSchema,
//   MorphemSchema,
//   morphemAnalysisOutputSchema,
//   AdjektivOutputSchema,
//   MatchSchema,
// };

// // canBeRexlexiv: z.optional(z.boolean()),
// // verbForms: z.array(z.array(z.string())),
// // notableGoverningPrepositions: z.optional(z.array(GoverningPrepositionSchema)),
// // numeraleType: z.array(NumeraleTypeSchema),

export const asdaasda = 1;
