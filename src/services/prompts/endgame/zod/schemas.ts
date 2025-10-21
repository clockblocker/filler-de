import { z } from "zod";

const VergleichsformSchema = z.enum(["Positiv", "Komparativ", "Superlativ"]);
const VerbFormTagSchema = z.enum([
  "Praesens",
  "Praeteritum",
  "Perfekt",
  "Imperativ",
  "KI",
  "KII",
  "PI",
  "PII",
  "ZuInfinitiv",
]);

// VerbFormTagSchema = z.record(VerbFormTagSchema, z.array(z.string())); // [ich, du, er, wir, ihr, sie]

const ConjugationSchema = z.enum(["Stark", "Schwach", "Gemischt"]);
const AdjektivDeklinationSchema = z.enum(["Stark", "Schwach", "Gemischt"]);

// ---

const KasusSchema = z.enum(["N", "G", "D", "A"]); // ["Nominativ", "Genitiv", "Dativ", "Akkusativ"]

const NomenDeklinationSchema = z.enum(["Stark", "Schwach", "Gemischt"]);
const RegelmaessigSchema = z.boolean(); // "Regelmaessig", "Unregelmaessig"

const TrennbarkeitSchema = z.enum(["Trennbar", "Untrennbar"]);

const AdverbCategorySchema = z.enum([
  "Lokal",
  "Temporal",
  "Modal",
  "Kausal",
  "Grad",
]);

const ArtikelTypeSchema = z.enum(["Bestimmt", "Unbestimmt"]);
const PartikelTypeSchema = z.enum([
  "Intensität",
  "Fokus",
  "Negation",
  "Abtönung",
  "Konnektiv",
]);

const NumeraleTypeSchema = z.enum([
  "Grundzahl",
  "Ordnungszahl",
  "Bruchzahl",
  "Multiplikativ",
  "Kollektiv",
]);
const KonjunktionTypeSchema = z.enum(["Koordinierend", "Subordinierend"]);

const GoverningPrepositionSchema = z.enum([
  "an",
  "auf",
  "bei",
  "bis",
  "durch",
  "für",
  "gegen",
  "in",
  "mit",
  "nach",
  "ohne",
  "um",
  "unter",
  "von",
  "vor",
  "während",
  "wegen",
  "trotz",
  "innerhalb",
  "außerhalb",
  "entlang",
  "mithilfe",
  "seit",
  "über",
  "als",
]);

// ---
const MatchSchema = z.enum(["Grundform", "Flexion", "Tippfehler", "Unbekannt"]);

const GenusSchema = z.enum(["F", "M", "N"]); // ["Feminin", "Maskulin", "Neutrum"]

const PronomenTypeSchema = z.enum([
  "Possessiv",
  "Reflexiv",
  "Personal",
  "Generalisierendes",
  "Demonstrativ",
  "W-Pronomen",
  "Indefinit",
  "Quantifikativ",
]);

const NumerusSchema = z.enum(["Einzahl", "Mehrzahl"]);

const CommonGrundformsFeildsSchema = z.object({
  grundform: z.string(),
  emojiBeschreibungs: z.array(z.string().emoji()), // Describe the common meanings with emojies; Up to 3 emojies per meaning. Aim for less, if possible
});

const WortartSchema = z.enum([
  "Nomen",
  "Pronomen",
  "Verb",
  "Adjektiv",
  "Adverb",
  "Artikel",
  "Partikel",
  "Praeposition",
  "Konjunktion",
  "Numerale",
  "Praefix",
  "Redewendung",
  "Interjektion",
  "Unbekannt",
]);

const NomenGrundformSchema = z.object({
  wortart: z.literal(WortartSchema.enum.Nomen),
  genus: GenusSchema,
  eigenname: z.optional(z.boolean()),
  ...CommonGrundformsFeildsSchema.shape,
});

const PronomenGrundformSchema = z.object({
  wortart: z.literal(WortartSchema.enum.Pronomen),
  pronomenType: PronomenTypeSchema,
  number: z.optional(z.array(NumerusSchema)),
  genera: z.optional(z.array(GenusSchema)),
  ...CommonGrundformsFeildsSchema.shape,
});

const VerbGrundformSchema = z.object({
  wortart: z.literal(WortartSchema.enum.Verb),
  ...CommonGrundformsFeildsSchema.shape,
});

const AdjektivGrundformSchema = z.object({
  wortart: z.literal(WortartSchema.enum.Adjektiv),
  ...CommonGrundformsFeildsSchema.shape,
});

const AdverbGrundformSchema = z.object({
  wortart: z.literal(WortartSchema.enum.Adverb),
  ...CommonGrundformsFeildsSchema.shape,
});

const ArtikelGrundformSchema = z.object({
  wortart: z.literal(WortartSchema.enum.Artikel),
  ...CommonGrundformsFeildsSchema.shape,
});

const PartikelGrundformSchema = z.object({
  wortart: z.literal(WortartSchema.enum.Partikel),
  ...CommonGrundformsFeildsSchema.shape,
});

const KonjunktionGrundformSchema = z.object({
  wortart: z.literal(WortartSchema.enum.Konjunktion),
  ...CommonGrundformsFeildsSchema.shape,
});

const PraepositionGrundformSchema = z.object({
  wortart: z.literal(WortartSchema.enum.Praeposition),
  ...CommonGrundformsFeildsSchema.shape,
});

const NumeraleGrundformSchema = z.object({
  wortart: z.literal(WortartSchema.enum.Numerale),
  ...CommonGrundformsFeildsSchema.shape,
});

const PraefixGrundformSchema = z.object({
  wortart: z.literal(WortartSchema.enum.Praefix),
  ...CommonGrundformsFeildsSchema.shape,
});

const InterjektionGrundformSchema = z.object({
  wortart: z.literal(WortartSchema.enum.Interjektion),
  ...CommonGrundformsFeildsSchema.shape,
});

const RedewendungGrundformSchema = z.object({
  wortart: z.literal(WortartSchema.enum.Redewendung),
  ...CommonGrundformsFeildsSchema.shape,
});

const UnbekanntGrundformSchema = z.object({
  wortart: z.literal(WortartSchema.enum.Unbekannt),
  comment: z.string(),
  ...CommonGrundformsFeildsSchema.shape,
});

const GrundformSchema = z.discriminatedUnion("wortart", [
  NomenGrundformSchema,
  PronomenGrundformSchema,
  VerbGrundformSchema,
  AdjektivGrundformSchema,
  AdverbGrundformSchema,
  ArtikelGrundformSchema,
  PartikelGrundformSchema,
  KonjunktionGrundformSchema,
  PraepositionGrundformSchema,
  NumeraleGrundformSchema,
  PraefixGrundformSchema,
  InterjektionGrundformSchema,
  RedewendungGrundformSchema,
  UnbekanntGrundformSchema,
]);

const grundformsOutputSchema = z
  .object({
    // This shall be a priority. We need to find every walid way to interprit the given input as a form of something
    [MatchSchema.enum.Grundform]: GrundformSchema.array(),
    [MatchSchema.enum.Flexion]: GrundformSchema.array(),
  })
  .or(
    z.object({
      [MatchSchema.enum.Grundform]: GrundformSchema.array(),
    }),
  )
  .or(
    z.object({
      [MatchSchema.enum.Flexion]: GrundformSchema.array(),
    }),
  )
  .or(
    z.object({
      [MatchSchema.enum.Tippfehler]: GrundformSchema.array(),
    }),
  )
  .or(
    z.object({
      [MatchSchema.enum.Unbekannt]: UnbekanntGrundformSchema.array(),
    }),
  );

// ---

const MorphemSchema = z.enum([
  "Zirkumfix",
  "Konversion",
  "Praefix",
  "Suffix",
  "Stamm",
  "Endung",
  "Fugenelement",
]);

const morphemAnalysisOutputSchema = z.object({
  morphemischeZerlegung: z.array(z.record(z.string(), MorphemSchema)),
  zusammengesetztAus: z.optional(z.array(z.record(z.string(), WortartSchema))),
});

const SteigerungsfaehigSchema = z.boolean(); // "Steigerungsfaehig", "Unsteigerungsfaehig"
const VergleichsgradSchema = z.enum(["Positiv", "Komparativ", "Superlativ"]);

const adjektivOutputSchema = z.array(
  z.object({
    adjektivstaemme: z.object({
      [VergleichsgradSchema.enum.Positiv]: z.string().array(),
      [VergleichsgradSchema.enum.Komparativ]: z.string().array().optional(),
      [VergleichsgradSchema.enum.Superlativ]: z.string().array().optional(),
    }),
    regelmaessig: RegelmaessigSchema,
    steigerungsfaehig: SteigerungsfaehigSchema,
  }),
);

export {
  SteigerungsfaehigSchema,
  VergleichsgradSchema,
  grundformsOutputSchema,
  GenusSchema,
  KasusSchema,
  WortartSchema,
  NomenGrundformSchema,
  PronomenTypeSchema,
  NumerusSchema,
  PronomenGrundformSchema,
  TrennbarkeitSchema,
  GoverningPrepositionSchema,
  VerbGrundformSchema,
  AdjektivGrundformSchema,
  AdverbCategorySchema,
  AdverbGrundformSchema,
  ArtikelTypeSchema,
  ArtikelGrundformSchema,
  PartikelTypeSchema,
  PartikelGrundformSchema,
  KonjunktionTypeSchema,
  KonjunktionGrundformSchema,
  PraepositionGrundformSchema,
  NumeraleTypeSchema,
  NumeraleGrundformSchema,
  PraefixGrundformSchema,
  InterjektionGrundformSchema,
  GrundformSchema,
  RedewendungGrundformSchema,
  VergleichsformSchema,
  VerbFormTagSchema,
  RegelmaessigSchema,
  ConjugationSchema,
  AdjektivDeklinationSchema,
  NomenDeklinationSchema,
  MorphemSchema,
  morphemAnalysisOutputSchema,
  adjektivOutputSchema,
  MatchSchema,
};

// canBeRexlexiv: z.optional(z.boolean()),
// verbForms: z.array(z.array(z.string())),
// notableGoverningPrepositions: z.optional(z.array(GoverningPrepositionSchema)),
// numeraleType: z.array(NumeraleTypeSchema),
