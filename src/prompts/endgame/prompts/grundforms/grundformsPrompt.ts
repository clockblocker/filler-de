import { grundformsOutputSchema } from "../../schemas/zodSchemas";

export const instructions = `<agent_background>
  You are a very smart and very helpful German language expert. You have deep expertise in linguistics and a thorough understanding of the edge cases of the language. You are very familiar with resources such as "grammis.ids-mannheim.de" and "verbformen.de" and may even be a contributor.
</agent_background>
<agent_role>
  Your task is to help the student navigate the German language. The student gives you a note with a German word or a short phrase, you must tell him all the possible ways of interptriting the note, linking the it's contents to varios feasible grundforms.
</agent_role>
<instructions>
  Your task is to generate a valid JSON object for every input word or expression, strictly following the provided JSON schema. Beyond simply assigning schema fields, incorporate your deep understanding of German language intricacies:
  - The note might contain small errors and is case insensitive (ex. a valid grundform of "sie" is "Sie")
  - Recognize and differentiate multiple parts of speech for a single word (e.g., a word that may function as both a noun and a verb).
  - Include additional fields for verbs such as canBeRexlexiv, separability, verbForms, and notableGoverningPrepositions, reflecting both common and edge-case conjugation patterns.
  - Address ambiguous forms by providing multiple objects when necessary.
  - Use concise emoji descriptions (up to 3 emojis) as visual cues that capture subtle differences in meaning.
  - Your output should consist solely of the final JSON without any extra commentary.
  - If the note does not contain any known idioms, or the word in in contains too many mistakes for recognotion, fallback to Unbekannt case
</instructions>`;

export const schema = `
<schema>import { z } from 'zod';

const KasusSchema = z.enum(["Nominativ", "Genitiv", "Dativ", "Akkusativ"]);
const GenusSchema = z.enum(["Feminin", "Maskulin", "Neutrum"]);
const NumerusSchema = z.enum(["Einzahl", "Mehrzahl"]);

const NomenDeklinationSchema = z.enum(["Stark", "Schwach"]);

const VergleichsformSchema = z.enum(["Positiv", "Komparativ", "Superlativ"]);
const VerbFormTagSchema = z.enum(["Praesens", "Praeteritum", "Perfekt", "Imperativ", "K1", "K2", "P1", "P2", "ZuInfinitiv"]);

const FormSchema = z.enum(["Grundform", "Flektiert"]);
const RegelmaessigkeitsSchema = z.enum(["Regelmaessig", "Unregelmaessig"]);

const ConjugationSchema = z.enum(["Stark", "Schwach", "Gemischt"]);
const AdjektivDeklinationSchema = z.enum(["Stark", "Schwach", "Gemischt"]);

const CommonFeildsSchema = z.object({
    rechtschreibung: z.string(),
    grundform: z.string(),
    emojiBeschreibung: z.string().emoji(), // Up to 3 emojies per note. Aim for less, if possible
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
  "PartizipialesAdjektiv",
  "Redewendung",
  "Interjektion",
  "Unbekannt"
]);

const NomenSchema = z.object({
  wortart: z.literal(WortartSchema.Enum.Nomen),
  genus: GenusSchema,
  deklination: NomenDeklinationSchema,
  isProperNoun: z.optional(z.boolean()),
  ...CommonFeildsSchema.shape,
});

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

const PronomenSchema = z.object({
  wortart: z.literal(WortartSchema.Enum.Pronomen),
  pronomenType: PronomenTypeSchema,
  number: z.optional(z.array(NumerusSchema)),
  genus: z.optional(z.array(GenusSchema)),
  ...CommonFeildsSchema.shape,
});

const SeparabilitySchema = z.enum(["Trennbar", "Untrennbar"]);
const GoverningPrepositionSchema = z.enum([
  "an", "auf", "bei", "bis", "durch", "für", "gegen", "in", "mit", "nach",
  "ohne", "um", "unter", "von", "vor", "während", "wegen", "trotz", "innerhalb",
  "außerhalb", "entlang", "mithilfe", "seit", "über",
]);

const VerbSchema = z.object({
  wortart: z.literal(WortartSchema.Enum.Verb),
  canBeRexlexiv: z.optional(z.boolean()),
  separability: z.optional(SeparabilitySchema),
  verbForms: z.array(z.array(z.string())),
  notableGoverningPrepositions: z.optional(z.array(GoverningPrepositionSchema)),
  ...CommonFeildsSchema.shape,
});

const AdjektivSchema = z.object({
  wortart: z.literal(WortartSchema.Enum.Adjektiv),
  ...CommonFeildsSchema.shape,
});
  
const PartizipVarianteSchema = z.enum(["P1", "P2"]);
const PartizipialesAdjektivSchema = AdjektivSchema.omit({ wortart: true }).extend({
  wortart: z.literal(WortartSchema.Enum.PartizipialesAdjektiv),
  partizipvariante: PartizipVarianteSchema,
});

const AdverbCategorySchema = z.enum(["Lokal", "Temporal", "Modal", "Kausal", "Grad"]);
const AdverbSchema = z.object({
  wortart: z.literal(WortartSchema.Enum.Adverb),
  category: z.array(AdverbCategorySchema),
  ...CommonFeildsSchema.shape,
});

const ArtikelTypeSchema = z.enum(["Bestimmt", "Unbestimmt"]);
const ArtikelSchema = z.object({
  wortart: z.literal(WortartSchema.Enum.Artikel),
  artikelType: ArtikelTypeSchema,
  ...CommonFeildsSchema.shape,
});

const PartikelTypeSchema = z.enum(["Intensität", "Fokus", "Negation", "Abtönung", "Konnektiv"]);
const PartikelSchema = z.object({
  wortart: z.literal(WortartSchema.Enum.Partikel),
  partikelType: z.array(PartikelTypeSchema),
  ...CommonFeildsSchema.shape,
});

const KonjunktionTypeSchema = z.enum(["Koordinierend", "Subordinierend"]);
const KonjunktionSchema = z.object({
  wortart: z.literal(WortartSchema.Enum.Konjunktion),
  konjunktionType: KonjunktionTypeSchema,
  ...CommonFeildsSchema.shape,
});

const PraepositionSchema = z.object({
  wortart: z.literal(WortartSchema.Enum.Praeposition),
  possibleGoverningKasuss: z.optional(z.array(KasusSchema)),
  ...CommonFeildsSchema.shape,
});

const NumeraleTypeSchema = z.enum(["Grundzahl", "Ordnungszahl", "Bruchzahl", "Multiplikativ", "Kollektiv"]);
const NumeraleSchema = z.object({
  wortart: z.literal(WortartSchema.Enum.Numerale),
  numeraleType: z.array(NumeraleTypeSchema),
  ...CommonFeildsSchema.shape,
});

const PraefixSchema = z.object({
  wortart: z.literal(WortartSchema.Enum.Praefix),
  ...CommonFeildsSchema.shape,
});

const InterjektionSchema = z.object({
  wortart: z.literal(WortartSchema.Enum.Interjektion),
  ...CommonFeildsSchema.shape,
});

const RedewendungSchema = z.object({
    wortart: z.literal(WortartSchema.Enum.Redewendung),
    ...CommonFeildsSchema.shape,
});

const UnbekanntSchema = z.object({
    wortart: z.literal(WortartSchema.Enum.Unbekannt),
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
  PartizipialesAdjektivSchema,
  RedewendungSchema,
  UnbekanntSchema,
]);

export const grundformsOutputSchema = z.array(GrundformSchema);
</schema>
<outputformat>outputformat shall be formattes as grundformsOutputSchema</outputformat>`;

export const examples = `<examples><example><note>sie</note><grundforms>[{wortart:"Pronomen",rechtschreibung:"sie",grundform:"sie",emojiBeschreibung:"👩",pronomenType:"Personal",number:["Einzahl"],genus:["Feminin"]},{wortart:"Pronomen",rechtschreibung:"sie",grundform:"sie",emojiBeschreibung:"👥",pronomenType:"Personal",number:["Mehrzahl"]},{wortart:"Pronomen",rechtschreibung:"Sie",grundform:"sie",emojiBeschreibung:"🧑‍💼",pronomenType:"Personal",number:["Einzahl","Mehrzahl"]}]</JSON></grundforms>,<example><note>glaubiger</note><grundforms>[{wortart:"Adjektiv",rechtschreibung:"gläubiger",grundform:"gläubig",emojiBeschreibung:"🙏"},{wortart:"Nomen",rechtschreibung:"Gläubiger",grundform:"Gläubiger",emojiBeschreibung:"💰",genus:"Maskulin",deklination:"Stark"}]</JSON></grundforms>,<example><note>genau</note><grundforms>[{wortart:"Adverb",rechtschreibung:"genau",grundform:"genau",emojiBeschreibung:"✔️",category:["Modal"]},{wortart:"Adjektiv",rechtschreibung:"genau",grundform:"genau",emojiBeschreibung:"✔️"}]</JSON></grundforms>,<example><note>genauso</note><grundforms>[{wortart:"Adverb",rechtschreibung:"genauso",grundform:"genauso",emojiBeschreibung:"🤝",category:["Modal"]}]</JSON></grundforms>,<example><note>fussballbegeistert</note><grundforms>[{wortart:"Adjektiv",rechtschreibung:"fußballbegeistert",grundform:"fußballbegeistert",emojiBeschreibung:"⚽️🔥"}]</JSON></grundforms>,<example><note>sofort</note><grundforms>[{wortart:"Adverb",rechtschreibung:"sofort",grundform:"sofort",emojiBeschreibung:"⏱️",category:["Temporal"]}]</JSON></grundforms>,<example><note>zwar</note><grundforms>[{wortart:"Partikel",rechtschreibung:"zwar",grundform:"zwar",emojiBeschreibung:"🔗",partikelType:["Konnektiv"]}]</JSON></grundforms>,<example><note>Weiss</note><grundforms>[{wortart:"Verb",rechtschreibung:"weiß",grundform:"wissen",emojiBeschreibung:"🧠",canBeRexlexiv:false,separability:"Untrennbar",verbForms:[["weiß"],["wusste"],["gewusst"]]},{wortart:"Nomen",rechtschreibung:"Weiß",grundform:"das Weiß",emojiBeschreibung:"⚪️",genus:"Neutrum",deklination:"Stark"},{wortart:"Adjektiv",rechtschreibung:"weiß",grundform:"weiß",emojiBeschreibung:"⚪️"}]</JSON></grundforms>,<example><note>erinern</note><grundforms>[{wortart:"Verb",rechtschreibung:"erinnern",grundform:"erinnern",emojiBeschreibung:"🧠",canBeRexlexiv:true,verbForms:[["erinnert"],["erinnerte"],["erinnert"]],notableGoverningPrepositions:["an"]}]</JSON></grundforms>,<example><note>rechnen</note><grundforms>[{wortart:"Verb",rechtschreibung:"rechnen",grundform:"rechnen",emojiBeschreibung:"🧮",canBeRexlexiv:false,verbForms:[["rechnet"],["rechnete"],["gerechnet"]],notableGoverningPrepositions:["mit","auf","in","als"]}]</JSON></grundforms>,<example><note>nieser</note><grundforms>[{wortart:"Verb",rechtschreibung:"niest",grundform:"niesen",emojiBeschreibung:"🤧",canBeRexlexiv:false,verbForms:[["niest"],["nieste"],["geniest"]]},{wortart:"Nomen",rechtschreibung:"Nieser",grundform:"Nieser",emojiBeschreibung:"🤧",genus:"Maskulin",deklination:"Schwach"}]</JSON></grundforms>,<example><note>sitz</note><grundforms>[{wortart:"Verb",rechtschreibung:"sitz",grundform:"sitzen",emojiBeschreibung:"💺",canBeRexlexiv:true,verbForms:[["sitzt"],["saß"],["gesessen"]]},{wortart:"Nomen",rechtschreibung:"Sitz",grundform:"Sitz",emojiBeschreibung:"🪑",genus:"Maskulin",deklination:"Stark"}]</JSON></grundforms>,<example><note>sitzen</note><grundforms>[{wortart:"Verb",rechtschreibung:"sitzen",grundform:"sitzen",emojiBeschreibung:"💺",canBeRexlexiv:true,verbForms:[["sitzt"],["saß"],["gesessen"]]}]</JSON></grundforms>,<example><note>aufgepast</note><grundforms>[{wortart:"Verb",rechtschreibung:"aufgepasst",grundform:"aufpassen",emojiBeschreibung:"👀",canBeRexlexiv:false,separability:"Trennbar",verbForms:[["passt auf"],["passte auf"],["aufgepasst"]]}]</JSON></grundforms>,<example><note>untergen</note><grundforms>[{wortart:"Verb",rechtschreibung:"untergehen",grundform:"untergehen",emojiBeschreibung:"🌅",canBeRexlexiv:false,separability:"Trennbar",verbForms:[["geht unter"],["ging unter"],["untergegangen"]]}]</JSON></grundforms>,<example><note>Hoffungen</note><grundforms>[{wortart:"Nomen",rechtschreibung:"Hoffnungen",grundform:"Hoffnung",emojiBeschreibung:"🙏",genus:"Feminin",deklination:"Stark"}]</JSON></grundforms>,<example><note>hängstauf</note><grundforms>[{wortart:"Verb",rechtschreibung:"hängst auf",grundform:"aufhängen",emojiBeschreibung:"🖼️",canBeRexlexiv:false,separability:"Trennbar",verbForms:[["hängt auf"],["hing auf"],["aufgehängt"]]}]</JSON></grundforms>,<example><note>hiemwerken</note><grundforms>[{wortart:"Verb",rechtschreibung:"heimwerken",grundform:"heimwerken",emojiBeschreibung:"🔨",canBeRexlexiv:false,separability:"Trennbar",verbForms:[["heimwerkt"],["heimwarkte"],["heimgearbeitet"]]},{wortart:"Nomen",rechtschreibung:"Heimwerken",grundform:"Heimwerk",emojiBeschreibung:"🛠",genus:"Neutrum",deklination:"Stark"}]</JSON></grundforms>,<example><note>klares</note><grundforms>[{wortart:"Adjektiv",rechtschreibung:"klares",grundform:"klar",emojiBeschreibung:"✨"}]</JSON></grundforms>,<example><note>Rechercheergbnisse</note><grundforms>[{wortart:"Nomen",rechtschreibung:"Rechercheergebnisse",grundform:"Rechercheergebnis",emojiBeschreibung:"🔍",genus:"Neutrum",deklination:"Stark"}]</JSON></grundforms>,<example><note>backen</note><grundforms>[{wortart:"Verb",rechtschreibung:"backen",grundform:"backen",emojiBeschreibung:"🍞",canBeRexlexiv:false,verbForms:[["backt","bäckt"],["buk"],["gebacken"]]},{wortart:"Verb",rechtschreibung:"backen",grundform:"backen",emojiBeschreibung:"🍞",canBeRexlexiv:false,verbForms:[["backt"],["backte"],["gebacken"]]},{wortart:"Nomen",rechtschreibung:"Backe",grundform:"Backe",emojiBeschreibung:"😊",genus:"Feminin",deklination:"Stark"}]</JSON></grundforms>,<example><note>unbandiges</note><grundforms>[{wortart:"Adjektiv",rechtschreibung:"unbandiges",grundform:"unbändig",emojiBeschreibung:"🔥"},]</JSON></grundforms>,<example><note>See</note><grundforms>[{wortart:"Nomen",rechtschreibung:"See",grundform:"See",emojiBeschreibung:"🏞",genus:"Maskulin",deklination:"Stark"},{wortart:"Nomen",rechtschreibung:"See",grundform:"See",emojiBeschreibung:"🌊",genus:"Feminin",deklination:"Stark"}]</JSON></grundforms>,<example><note>trotz</note><grundforms>[{wortart:"Praeposition",rechtschreibung:"trotz",grundform:"trotz",emojiBeschreibung:"🛡",possibleGoverningKasuss:["Genitiv"]},{wortart:"Nomen",rechtschreibung:"Trotz",grundform:"Trotz",emojiBeschreibung:"😤",genus:"Maskulin",deklination:"Stark",isProperNoun:false},{wortart:"Verb",rechtschreibung:"trotzen",grundform:"trotzen",emojiBeschreibung:"😤",canBeRexlexiv:false,separability:"Untrennbar",verbForms:[["trotzt"],["trotzte"],["getrotzt"]]}]</JSON></grundforms>,<example><note>mit</note><grundforms>[{wortart:"Praeposition",rechtschreibung:"mit",grundform:"mit",emojiBeschreibung:"🤝",possibleGoverningKasuss:["Dativ"]},{wortart:"Praefix",rechtschreibung:"mit",grundform:"mit",emojiBeschreibung:"🤝"}]</JSON></grundforms>,<example><note>an</note><grundforms>[{wortart:"Praeposition",rechtschreibung:"an",grundform:"an",emojiBeschreibung:"📍",possibleGoverningKasuss:["Dativ","Akkusativ"]},{wortart:"Praefix",rechtschreibung:"an",grundform:"an",emojiBeschreibung:"📍"}]</JSON></grundforms>,<example><note>uber</note><grundforms>[{wortart:"Praeposition",rechtschreibung:"über",grundform:"über",emojiBeschreibung:"🔝",possibleGoverningKasuss:["Dativ","Akkusativ"]},{wortart:"Praefix",rechtschreibung:"über",grundform:"über",emojiBeschreibung:"🔝"},{wortart:"Nomen",rechtschreibung:"Uber",grundform:"Uber",emojiBeschreibung:"🏙️",genus:"Neutrum",deklination:"Stark",isProperNoun:true}]</JSON></grundforms>,<example><note>selbst</note><grundforms>[{wortart:"Adverb",rechtschreibung:"selbst",grundform:"selbst",emojiBeschreibung:"🙋",category:["Modal"]},{wortart:"Nomen",rechtschreibung:"Selbst",grundform:"Selbst",emojiBeschreibung:"🪞",genus:"Neutrum",deklination:"Stark"},]</JSON></grundforms>,<example><note>umfaren</note><grundforms>[{wortart:"Verb",rechtschreibung:"umfahren",grundform:"umfahren",emojiBeschreibung:"🚗💥",canBeRexlexiv:false,separability:"Trennbar",verbForms:[["fährt um"],["fuhr um"],["umgefahren"]]},{wortart:"Verb",rechtschreibung:"umfahren",grundform:"umfahren",emojiBeschreibung:"🚗🛣️",canBeRexlexiv:false,separability:"Untrennbar",verbForms:[["umfährt"],["umfuhr"],["umgefahren"]]},{wortart:"Nomen",rechtschreibung:"Umfahren",grundform:"Umfahrt",emojiBeschreibung:"🛣️",genus:"Feminin",deklination:"Stark"}]</JSON></grundforms>,<example><note>geoffnet</note><grundforms>[{wortart:"PartizipialesAdjektiv",rechtschreibung:"geöffnet",grundform:"öffnen",emojiBeschreibung:"🚪👐",partizipvariante:"P2"},]</JSON></grundforms>,<example><note>verfallen</note><grundforms>[{wortart:"Verb",rechtschreibung:"verfallen",grundform:"verfallen",emojiBeschreibung:"🏚️",canBeRexlexiv:false,separability:"Untrennbar",verbForms:[["verfällt"],["verfiel"],["verfallen"]]},{wortart:"PartizipialesAdjektiv",rechtschreibung:"verfallen",grundform:"verfallen",emojiBeschreibung:"🏚️",partizipvariante:"P2"}]</JSON></grundforms>,<example><note>Schloss</note><grundforms>[{wortart:"Nomen",rechtschreibung:"Schloss",grundform:"Schloss",emojiBeschreibung:"🏰",genus:"Neutrum",deklination:"Stark",isProperNoun:false},{wortart:"Nomen",rechtschreibung:"Schloss",grundform:"Schloss",emojiBeschreibung:"🔒",genus:"Neutrum",deklination:"Stark",isProperNoun:false},{wortart:"Verb",rechtschreibung:"Schloss",grundform:"schließen",emojiBeschreibung:"🚪🔒",canBeRexlexiv:false,regularity:"Unregelmäßig",conjugation:"Stark",separability:"Untrennbar"}]</JSON></grundforms>,<example><note>gehobener</note><grundforms>[{wortart:"Adjektiv",rechtschreibung:"gehoben",grundform:"gehoben",emojiBeschreibung:"🎩"}]</JSON></grundforms>,<example><note>wahlwiese</note><grundforms>[{wortart:"Adverb",rechtschreibung:"wahlweise",grundform:"wahlweise",emojiBeschreibung:"🔀",category:["Modal"]}]</JSON></grundforms>,<example><note>deutschen</note><grundforms>[{wortart:"Adjektiv",rechtschreibung:"deutschen",grundform:"deutsch",emojiBeschreibung:"🇩🇪"},{wortart:"Nomen",rechtschreibung:"Deutsche",grundform:"Deutsche",emojiBeschreibung:"🇩🇪",genus:"Neutrum",deklination:"Stark",isProperNoun:false}]</JSON></grundforms>,<example><note>Wende</note><grundforms>[{wortart:"Nomen",rechtschreibung:"Wende",grundform:"Wende",emojiBeschreibung:"🔄",genus:"Feminin",deklination:"Stark",isProperNoun:false},{wortart:"Verb",rechtschreibung:"wende",grundform:"wenden",emojiBeschreibung:"↩️",canBeRexlexiv:false,separability:"Untrennbar",verbForms:[["wendet"],["wendete"],["gewendet"]]}]</JSON></grundforms>,<example><note>stapelbaren</note><grundforms>[{wortart:"Adjektiv",rechtschreibung:"stapelbaren",grundform:"stapelbar",emojiBeschreibung:"📦"}]</JSON></grundforms>,<example><note>vorbei</note><grundforms>[{wortart:"Praeposition",rechtschreibung:"vorbei",grundform:"vorbei",emojiBeschreibung:"🏃‍♂️💨"},{wortart:"Adverb",rechtschreibung:"vorbei",grundform:"vorbei",emojiBeschreibung:"🏁",category:["Lokal"]}]</JSON></grundforms>,<example><note>spazirengegangen</note><grundforms>[{wortart:"Verb",rechtschreibung:"spazieren gegangen",grundform:"spazieren gehen",emojiBeschreibung:"🚶‍♂️",canBeRexlexiv:false,separability:"Trennbar",verbForms:[["geht spazieren"],["ging spazieren"],["spazieren gegangen"]]}]</JSON></grundforms>,<example><note>doch</note><grundforms>[{wortart:"Partikel",rechtschreibung:"doch",grundform:"doch",emojiBeschreibung:"💬",partikelType:["Konnektiv"]}]</JSON></grundforms>,<example><note>a – das Kissen hab’ ich auch [[bekommen]].  \nAber es ist vorbei! [[vorbei]]! Und [[jetzt]] [[heul]] bitte nicht!  \nTschüs.  \nMänner!</note><grundforms>[{wortart:"Unbekannt",rechtschreibung:"Unbekannt",grundform:"Unbekannt",emojiBeschreibung:"❓"}]</JSON></grundforms>,<example><note>Laden</note><grundforms>[{wortart:"Verb",rechtschreibung:"laden",grundform:"laden",emojiBeschreibung:"📦",canBeRexlexiv:false,regularity:"Regelmäßig",conjugation:"Schwach"},{wortart:"Nomen",rechtschreibung:"Laden",grundform:"Laden",emojiBeschreibung:"🏪",genus:"Maskulin",deklination:"Stark",isProperNoun:false}]</JSON></grundforms>,<example><note>gefallen</note><grundforms>[{wortart:"Verb",rechtschreibung:"gefallen",grundform:"gefallen",emojiBeschreibung:"👍",canBeRexlexiv:false,separability:"Untrennbar",verbForms:[["gefällt"],["gefiel"],["gefallen"]]},{wortart:"PartizipialesAdjektiv",rechtschreibung:"gefallen",grundform:"gefallen",emojiBeschreibung:"👍",partizipvariante:"P2"}]</JSON></grundforms>,<example><note>Das Eis zwischen sie ist gebrochen</note><grundforms>[{wortart:"Redewendung",rechtschreibung:"Das Eis brechen",grundform:"Das Eis brechen",emojiBeschreibung:"❄️🧊"}]</JSON></grundforms>,<example><note>klar</note><grundforms>[{wortart:"Adjektiv",rechtschreibung:"klar",grundform:"klar",emojiBeschreibung:"✨"},{wortart:"Adverb",rechtschreibung:"klar",grundform:"klar",emojiBeschreibung:"✨",category:["Grad"]},{wortart:"Nomen",rechtschreibung:"das Klare",grundform:"das Klare",emojiBeschreibung:"✨",genus:"Neutrum",deklination:"Stark"}]</JSON></grundforms>,<example><note>mleken</note><grundforms>[{wortart:"Verb",rechtschreibung:"melken",grundform:"melken",emojiBeschreibung:"🐄",canBeRexlexiv:false,verbForms:[["melkt"],["melkte"],["gemelkt"]]},{wortart:"Verb",rechtschreibung:"melken",grundform:"melken",emojiBeschreibung:"🐄",canBeRexlexiv:false,verbForms:[["melkt","milkt"],["molk"],["gemelkt","gemolken"]]}]</JSON></grundforms>,<example><note>bewegen</note><grundforms>[{wortart:"Verb",rechtschreibung:"bewegen",grundform:"bewegen",emojiBeschreibung:"🏃",canBeRexlexiv:false,separability:"Untrennbar",verbForms:[["bewegt"],["bewegte"],["bewegt"]]},{wortart:"Verb",rechtschreibung:"bewegen",grundform:"bewegen",emojiBeschreibung:"❤️",canBeRexlexiv:false,separability:"Untrennbar",verbForms:[["bewegt"],["bewog"],["bewegt"]]}]</JSON></grundforms>,<example><note>senden</note><grundforms>[{wortart:"Verb",rechtschreibung:"senden",grundform:"senden",emojiBeschreibung:"📤",canBeRexlexiv:false,verbForms:[["sendet"],["sendete"],["gesendet"]]},{wortart:"Verb",rechtschreibung:"senden",grundform:"senden",emojiBeschreibung:"📡",canBeRexlexiv:false,verbForms:[["sendet"],["sandte"],["gesandt"]]}]</JSON></grundforms>,<example><note>eis zwischen ihnen ist gebrochen</note><grundforms>[{wortart:"Redewendung",rechtschreibung:"das Eis zwischen ihnen ist gebrochen",grundform:"das Eis brechen",emojiBeschreibung:"🤝"}]</JSON></grundforms>,<example><note>halben Miete</note><grundforms>[{wortart:"Redewendung",rechtschreibung:"halbe Miete",grundform:"die halbe Miete",emojiBeschreibung:"🔑🧩🎯"}]</JSON></grundforms>,<example><note>ganz und gar</note><grundforms>[{wortart:"Redewendung",rechtschreibung:"ganz und gar",grundform:"ganz und gar",emojiBeschreibung:"💯👌"}]</JSON></grundforms>,<example><note>tomaten auf den Augen?</note><grundforms>[{wortart:"Redewendung",rechtschreibung:"Tomaten auf den Augen?",grundform:"Tomaten auf den Augen haben",emojiBeschreibung:"🍅🙈🤷‍♂️"}]</JSON></grundforms>,<example><note>mir der Bär aufgebracht</note><grundforms>[{wortart:"Redewendung",rechtschreibung:"Mir ist der Bär aufgebracht",grundform:"Einen Bären aufbinden",emojiBeschreibung:"🐻🤥🙄"}]</JSON></grundforms>,<example><note>durch und durch</note><grundforms>[{wortart:"Redewendung",rechtschreibung:"durch und durch",grundform:"durch und durch",emojiBeschreibung:"💯👌"}]</JSON></grundforms>,<example><note>voll und ganz</note><grundforms>[{wortart:"Redewendung",rechtschreibung:"voll und ganz",grundform:"voll und ganz",emojiBeschreibung:"🎯👌"}]</JSON></grundforms>,<example><note>null und nichtig</note><grundforms>[{wortart:"Redewendung",rechtschreibung:"null und nichtig",grundform:"null und nichtig",emojiBeschreibung:"0️⃣🚫"}]</JSON></grundforms>,<example><note>klipp und klar</note><grundforms>[{wortart:"Redewendung",rechtschreibung:"klipp und klar",grundform:"klipp und klar",emojiBeschreibung:"✅"}]</JSON></grundforms>,<example><note>rein und gar</note><grundforms>[{wortart:"Redewendung",rechtschreibung:"rein und gar",grundform:"rein und gar",emojiBeschreibung:"✨👌"}]</JSON></grundforms></examples>`;

export const grundformsPrompt = instructions + grundformsOutputSchema + examples;
