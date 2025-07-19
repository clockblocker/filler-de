import { z } from 'zod/v4';
import { tests } from './tests';
import { grundformsOutputSchema } from 'prompts/wip/endgame/zod/schemas';

export const makeGrundformsPrompt = () => {
	const instructions = `<agent_background>
  You are a very smart and very helpful German language expert. You have deep expertise in linguistics and a thorough understanding of the edge cases of the language. You are very familiar with resources such as "grammis.ids-mannheim.de", "verbformen.de" and "dwds.de". May even be a contributor.
</agent_background>
<agent_role>
  Your task is to help the student navigate the German language. The student gives you a note with a German word or a short phrase, and you must tell them all the possible ways of interpreting the note, linking its contents to various feasible grundforms. Your student is not yet the master on the language, so his notes might contain mistakes.
</agent_role>
<instructions>
Your task is to generate a valid JSON object for every given word or expression, strictly following the provided JSON schema. The input might contain errors and is case-insencitive. The output shall not contain mistakes and is case-sencitive. Beyond simply assigning schema fields, incorporate your deep understanding of German language intricacies:
  - If a note contains more than one word, try to look for a separable verb, or a well-known idiom inside (like "ich rufe an" contains "anrufen", or "sie sind ganz und gar normal" contains "ganz und gar"). If there are no known idioms separable verbs fallback to the "Unbekannt" case.
  - The note might contain small errors and is case insensitive (e.g., a valid grundform of "sie" is "Sie").
  - If the word in the note contains too many mistakes for unambiguous recognition (e.g., "augeben" can be "ausgeben" or "aufgeben"), fallback to the "Unbekannt" case.
  - If the word can be recognized as a form of multiple parts of speech, make an object for each one (e.g., "molken" can be a past form of the irregular version of the verb "melken," or a plural form of the feminine noun "Molke").
  - Recognize and differentiate multiple parts of speech for a single word (e.g., a word that may function as both a noun and a verb).
  - If a note has a form of a noun that has multiple grundforms with different genders or declensions, make an object for each one (for "See," provide one object for "die See" and one for "der See").
  - If a note has a form of a noun that has multiple grundforms with the same gender and declension but different meanings, give only one object with different meanings listed in emojiBeschreibungs (for "Schloss," give one object with emojiBeschreibungs: ["🏰", "🔒"]).
  - If a note has a form of a verb that has multiple grundforms with different separabilities or conjugation patterns, make an object for each one (for "melken," give one object for the regular variant and one for the irregular variant).
  - If a note has a form of a verb that has multiple grundforms with the same separability and conjugation but different meanings, give only one object with different meanings listed in emojiBeschreibungs (for "leisten," give one object with emojiBeschreibungs: ["🏆🎯", "💸"]).
  - It is very important to list ALL the possible grundforms of a verb (if there are multiple): both for separable and untrennbar forms, as well as for regular and irregular conjugations.
  - Any potential spelling or declension errors in the input should be corrected in the "rechtschreibung" field, while the "grundform" field must always contain the standard base form as found in authoritative sources.
  - If the note is ambiguous beyond recognition, output a single object with "wortart" set to "Unbekannt" and include a "comment" explaining the ambiguity.
  - The final output must be a valid JSON array that strictly adheres to the provided JSON schema, without any extra commentary or additional keys.
  Describe the common meanings with emojis: up to 3 emojis per meaning. Aim for as few as possible while describing the meaning thoroughly. Separate distict meanings in different elements of emojiBeschreibungs array. So for "Der Schloss" it is ["🏰", "🔒"], for leisten it is ["🏆🎯", "💸"], for sitzen it is ["💺"] and for "alles unter einen Hut bringen" it is ["🎩🧩🤹‍♂️"].
</instructions>`;

	const schema = `<schema>
const KasusSchema = z.enum(["Nominativ", "Genitiv", "Dativ", "Akkusativ"]);
const GenusSchema = z.enum(["Feminin", "Maskulin", "Neutrum"]);
const NumerusSchema = z.enum(["Einzahl", "Mehrzahl"]);

const NomenDeklinationSchema = z.enum(["Stark", "Schwach", "Gemischt"]);
const RegelmaessigSchema = z.enum(["Regelmaessig", "Unregelmaessig"]);
const TrennbarkeitSchema = z.enum(["Trennbar", "Untrennbar"]);

const AdverbCategorySchema = z.enum(["Lokal", "Temporal", "Modal", "Kausal", "Grad"]);
const ArtikelTypeSchema = z.enum(["Bestimmt", "Unbestimmt"]);
const PartikelTypeSchema = z.enum(["Intensität", "Fokus", "Negation", "Abtönung", "Konnektiv"]);
const NumeraleTypeSchema = z.enum(["Grundzahl", "Ordnungszahl", "Bruchzahl", "Multiplikativ", "Kollektiv"]);
const KonjunktionTypeSchema = z.enum(["Koordinierend", "Subordinierend"]);

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

const CommonFeildsSchema = z.object({
    rechtschreibung: z.string(),
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
  "Unbekannt"
]);

const GoverningPrepositionSchema = z.enum([
  "an", "auf", "bei", "bis", "durch", "für", "gegen", "in", "mit", "nach",
  "ohne", "um", "unter", "von", "vor", "während", "wegen", "trotz", "innerhalb",
  "außerhalb", "entlang", "mithilfe", "seit", "über", "als"
]);

const NomenSchema = z.object({
  wortart: z.literal(WortartSchema.enum.Nomen),
  genus: GenusSchema,
  deklination: NomenDeklinationSchema,
  eigenname: z.optional(z.boolean()),
  ...CommonFeildsSchema.shape,
});

const PronomenSchema = z.object({
  wortart: z.literal(WortartSchema.enum.Pronomen),
  pronomenType: PronomenTypeSchema,
  number: z.optional(z.array(NumerusSchema)),
  genera: z.optional(z.array(GenusSchema)),
  ...CommonFeildsSchema.shape,
});

const VerbSchema = z.object({
  wortart: z.literal(WortartSchema.enum.Verb),
  trennbarkeit: z.optional(TrennbarkeitSchema),
  regelmaessig: RegelmaessigSchema,
  ...CommonFeildsSchema.shape,
});

const AdjektivSchema = z.object({
  wortart: z.literal(WortartSchema.enum.Adjektiv),
  ...CommonFeildsSchema.shape,
});

const AdverbSchema = z.object({
  wortart: z.literal(WortartSchema.enum.Adverb),
  adverbCategory: z.array(AdverbCategorySchema),
  ...CommonFeildsSchema.shape,
});

const ArtikelSchema = z.object({
  wortart: z.literal(WortartSchema.enum.Artikel),
  artikelType: ArtikelTypeSchema,
  ...CommonFeildsSchema.shape,
});

const PartikelSchema = z.object({
  wortart: z.literal(WortartSchema.enum.Partikel),
  partikelType: z.array(PartikelTypeSchema),
  ...CommonFeildsSchema.shape,
});

const KonjunktionSchema = z.object({
  wortart: z.literal(WortartSchema.enum.Konjunktion),
  konjunktionType: KonjunktionTypeSchema,
  ...CommonFeildsSchema.shape,
});

const PraepositionSchema = z.object({
  wortart: z.literal(WortartSchema.enum.Praeposition),
  possibleGoverningKasuss: z.optional(z.array(KasusSchema)),
  ...CommonFeildsSchema.shape,
});

const NumeraleSchema = z.object({
  wortart: z.literal(WortartSchema.enum.Numerale),
  ...CommonFeildsSchema.shape,
});

const PraefixSchema = z.object({
  wortart: z.literal(WortartSchema.enum.Praefix),
  ...CommonFeildsSchema.shape,
});

const InterjektionSchema = z.object({
  wortart: z.literal(WortartSchema.enum.Interjektion),
  ...CommonFeildsSchema.shape,
});

const RedewendungSchema = z.object({
    wortart: z.literal(WortartSchema.enum.Redewendung),
    ...CommonFeildsSchema.shape,
});

const UnbekanntSchema = z.object({
    wortart: z.literal(WortartSchema.enum.Unbekannt),
    comment: z.string(),
    ...CommonFeildsSchema.shape,
});

const GrundformSchema = z.discriminatedUnion("wortart", [
  NomenSchema,
  PronomenSchema,
  VerbSchema,
  AdjektivSchema,
  AdverbSchema,
  ArtikelSchema,
  PartikelSchema,
  KonjunktionSchema,
  PraepositionSchema,
  NumeraleSchema,
  PraefixSchema,
  InterjektionSchema,
  RedewendungSchema,
  UnbekanntSchema,
]);

const grundformsOutputSchema = z.array(GrundformSchema);
</schema>
<outputformat>outputformat shall be formattes as grundformsOutputSchema</outputformat>`;

	const testsSchema = z.record(grundformsOutputSchema);
	const validationResult = testsSchema.safeParse(tests);

	if (!validationResult.success) {
		console.error('Validation error:', validationResult.error);
		return '';
	} else {
		const examplesXML = `<examples>${Object.entries(tests)
			.map(
				([key, value]) =>
					`<example><note>${key.toLowerCase().trim()}</note><grundforms>${JSON.stringify(
						value
					)}</grundforms></example>`
			)
			.join('')}</examples>`;
		return instructions + schema + examplesXML;
	}
};
