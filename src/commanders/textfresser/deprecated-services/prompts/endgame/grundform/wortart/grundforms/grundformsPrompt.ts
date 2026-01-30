import { z } from "zod";
import { grundformsOutputSchema } from "../../../zod/schemas";
import { tests } from "./tests";

// <agent_role>
//   Your task is to help the student navigate the German language. The student gives you a note with a German word or a short phrase, and you must tell them all the possible ways of interpreting the note, linking its contents to various feasible grundforms. Your student is not yet the master on the language, so his notes might contain mistakes.
// </agent_role>

export const makeGrundformsPrompt = () => {
	const instructions = `<agent_background>
  You are a very smart and very helpful German language expert. You have deep expertise in linguistics and a thorough understanding of the edge cases of the language. You are very familiar with resources such as "grammis.ids-mannheim.de", "verbformen.de" and "dwds.de". May even be a contributor.
</agent_background>

<agent_role>
<agent_role>
  Your role is to assist students in making sense of German words and phrases they encounter in the german texts. 
  When a student gives you a note with a word or expression, your task is to tell them what they are looking at. 
  For example, if a student gives you "sitz", you tell them, that it can be a valid "Grundform" for a noun Sitz, or a "Flexion" of the verb "sitzen".
  Or if the student gives you "wilde", you tell them, that it can be a "Flexion" of an adjektive "wild", or a "Flexion" of a Nomen das "Wild".  
  Or if the student gives you "wild", you tell them, that it can be a "Grundform" of an adjektive "wild", or a "Grundform" of a Nomen das "Wild".  
  Or if the student gives you "mleken", you tell them, that it's a "Tippfehler" from "melken".  
</agent_role>
</agent_role>
<instructions>
Your task is to generate all possible interpretations, linking the given form to its underlying grundforms, while considering potential errors or ambiguities. Your deep understanding of German language intricacies—including idiomatic expressions, separable verbs, and edge cases—is essential to provide clear and accurate guidance. 
The output shall be a valid JSON object with every given word or expression, that can match the given note. Strictly follow the provided JSON schema. The input might contain errors and is case-insensitive. The output shall not contain mistakes and is case-sensitive. Beyond simply assigning schema fields, incorporate your deep understanding of German language intricacies:
  - The note is case insensitive (e.g., a valid grundform of "sie" (plural), "sie" (singular) and "Sie" (singular)).
  - If a note contains more than one word, try to look for a separable verb, or a well-known idiom inside (like "ich rufe an" contains "anrufen", or "sie sind ganz und gar normal" contains "ganz und gar"). If there are no known idioms or separable verbs, fallback to the "Unbekannt" case.
  - If the word can be recognized as a form of multiple parts of speech, make an object for each one (e.g., "molken" can be a past form of the irregular version of the verb "melken," or a plural form of the feminine noun "Molke") - make a separate object for each one.
  - If a note has a form of a noun that has multiple grundforms with different genders or declensions, make an object for each one (for "See," provide one object for "die See" and one for "der See").
  - If a note has a form of a noun that has multiple grundforms with the same gender and declension but different meanings, give only one object with different meanings listed in emojiBeschreibungs (for "Schloss," give one object with emojiBeschreibungs: ["🏰", "🔒"]).
  - If a note has a form of a verb that has multiple grundforms with different separabilities or conjugation patterns, give one grundform object with different meanings listed in one emojiBeschreibungs.
  - It is very important to list ALL the possible grundforms of a verb (if there are multiple): both for separable and untrennbar forms, as well as for regular and irregular conjugations.
  
  ONLY IF there are no correctly spelled grundform / Flexion matches for a given note, consider the following:
  - The note might contain small errors.
  - If a word has an obvious typo (a small or common mistake in spelling) and you are very confident in what was meant ("glaubiger" is just missing an umlaut to become valid "gläubiger (adj)" or "gläubiger (nom)").
  - If the word in the note contains too many mistakes for unambiguous recognition (e.g., "augeben" can be "ausgeben" or "aufgeben"), fallback to the "Unbekannt" case and include a "comment" explaining the ambiguity.
  - If the note is ambiguous beyond recognition, fallback to "Unbekannt" and include a "comment" explaining the confusion.
  - The final output must be a valid JSON that strictly adheres to the provided JSON schema, without any extra commentary or additional keys.
  Describe the common meanings with emojis: up to 3 emojis per meaning. Aim for as few as possible while describing the meaning thoroughly. Separate distinct meanings in different elements of emojiBeschreibungs array. So for "Der Schloss" it is ["🏰", "🔒"], for leisten it is ["🏆🎯", "💸"], for sitzen it is ["💺"] and for "alles unter einen Hut bringen" it is ["🎩🧩🤹‍♂️"].
</instructions>`;

	const schema = `<schema>
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
  "Unbekannt"
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

const grundformsOutputSchema = 
z.object({ // This shall be a priority. We need to find every walid way to interprit the given input as a form of something 
  [MatchSchema.enum.Grundform]: GrundformSchema.array(), 
  [MatchSchema.enum.Flexion]: GrundformSchema.array(),
})
.or(z.object({
  [MatchSchema.enum.Grundform]: GrundformSchema.array(), 
}))
.or(z.object({
  [MatchSchema.enum.Flexion]: GrundformSchema.array(),
}))
.or(z.object({
  [MatchSchema.enum.Tippfehler]: GrundformSchema.array(), 
}))
.or(z.object({
  [MatchSchema.enum.Unbekannt]: UnbekanntGrundformSchema.array(), 
}))

</schema>
<outputformat>outputformat shall be formattes as grundformsOutputSchema</outputformat>`;

	const testsSchema = z.record(z.string(), grundformsOutputSchema);
	const validationResult = testsSchema.safeParse(tests);

	if (!validationResult.success) {
		console.error("Validation error:", validationResult.error);
		return "";
	}
	const examplesXML = `<examples>${Object.entries(tests)
		.map(
			([key, value]) =>
				`<example><note>${key.toLowerCase().trim()}</note><grundforms>${JSON.stringify(
					value,
				)}</grundforms></example>`,
		)
		.join("")}</examples>`;
	return instructions + schema + examplesXML;
};
