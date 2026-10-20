import { makeSurfaceId, type ReadingEntry, type SurfaceEntry } from "dumdict";
import { createPendingSemanticRelationRecord } from "dumdict/pending";
import { syncretize } from "dumling";
import type * as Dumling from "dumling/types";
import type { LemmaNoteData } from "../src";

type De = "de";
type Lemma<
	F extends Dumling.Family<De>,
	K extends Dumling.Kind<De, F>,
> = Dumling.Lemma<De, F, K>;

function readingEntry(
	reading: Dumling.Reading<De>,
	content: Partial<Omit<ReadingEntry<De>, "reading">> = {},
): ReadingEntry<De> {
	return {
		attestations: [],
		attestedTranslations: [],
		notes: "",
		reading,
		...content,
	};
}

function reading<L extends Dumling.Lemma<De>>(
	lemma: L,
	emojiDescription: string,
): Dumling.Reading<De> {
	return {
		emojiDescription,
		lemma,
		unitKind: "Reading",
	} as Dumling.Reading<De>;
}

// NOUN: two Readings of one Lemma, owned Surfaces, pending relations and
// relations in Lemma target mode.

export const mutter: Lemma<"Lexeme", "NOUN"> = {
	canonicalForm: "Mutter",
	coreFeatures: { gender: "Fem" },
	family: "Lexeme",
	kind: "NOUN",
	language: "de",
	unitKind: "Lemma",
};

const mama: Lemma<"Lexeme", "NOUN"> = {
	canonicalForm: "Mama",
	coreFeatures: { gender: "Fem" },
	family: "Lexeme",
	kind: "NOUN",
	language: "de",
	unitKind: "Lemma",
};

const mutterParent = reading(mutter, "👩");
const mutterNut = reading(mutter, "🔩");

const muetterSurface: Dumling.Surface<De, "Lexeme", "NOUN"> = {
	inflectionalFeatures: { case: "Nom", gender: null, number: "Plur" },
	language: "de",
	lemma: mutter,
	normalizedSurface: "Mütter",
	spelling: { kind: "Canonical" },
	surfaceFeatures: null,
	unitKind: "Surface",
};

function ownedSurface(
	surface: Dumling.Surface<De>,
	content: Partial<Omit<SurfaceEntry<De>, "id" | "surface">> = {},
): SurfaceEntry<De> {
	return {
		attestations: [],
		attestedTranslations: [],
		id: makeSurfaceId("de", surface),
		notes: "",
		ownerLemma: surface.lemma as Dumling.Lemma<De>,
		surface,
		...content,
	};
}

export const nounData: LemmaNoteData<De> = {
	lemmaRecord: { lemma: mutter },
	ownedSurfaceEntries: [
		ownedSurface(muetterSurface, {
			attestations: ["![[Scroll#^12|^]]"],
			attestedTranslations: ["mothers"],
			notes: "plural",
		}),
	],
	pendingRelations: [
		createPendingSemanticRelationRecord(mutterParent, {
			relation: "hypernym",
			target: {
				canonicalForm: "Elternteil",
				family: "Lexeme",
				kind: "NOUN",
				language: "de",
			},
		}),
		createPendingSemanticRelationRecord(mutterParent, {
			relation: "antonym",
			target: {
				canonicalForm: "Vater",
				family: "Lexeme",
				kind: "NOUN",
				language: "de",
			},
		}),
	],
	readingEntries: [
		readingEntry(mutterParent, {
			attestations: ["![[Scroll#^3|^]]", "![[Other Scroll#^7|^]]"],
			attestedTranslations: ["mother"],
			knowledge: {
				definition: "A female parent; 100% of the time %% loved.",
				plural: ["Mütter"],
				semanticRelations: { synonym: [mama], targetKind: "lemma" },
				transcription: "ˈmʊtɐ",
				translations: { en: ["mother"], ru: ["мать", "мама"] },
			},
			notes: "First line\n\nSecond paragraph with %%tf:identity {}%% inside.",
		}),
		readingEntry(mutterNut, {
			knowledge: {
				plural: ["Muttern"],
				translations: { en: ["nut"] },
			},
		}),
	],
};

// Separable VERB with a Valency Frame and a Morphological Tree.

const aufstehen: Lemma<"Lexeme", "VERB"> = {
	canonicalForm: "aufstehen",
	coreFeatures: { hasSepPrefix: "auf", lexicallyReflexive: null },
	family: "Lexeme",
	kind: "VERB",
	language: "de",
	unitKind: "Lemma",
};

const aufPrefix: Lemma<"Morpheme", "Prefix"> = {
	canonicalForm: "auf",
	coreFeatures: { hasSepPrefix: "auf" },
	family: "Morpheme",
	kind: "Prefix",
	language: "de",
	unitKind: "Lemma",
};

const fuer: Lemma<"Lexeme", "ADP"> = {
	canonicalForm: "für",
	coreFeatures: {},
	family: "Lexeme",
	kind: "ADP",
	language: "de",
	unitKind: "Lemma",
};

export const verbData: LemmaNoteData<De> = {
	lemmaRecord: { lemma: aufstehen },
	ownedSurfaceEntries: [],
	pendingRelations: [],
	readingEntries: [
		readingEntry(reading(aufstehen, "🛏️"), {
			attestations: ["![[Morgen#^2|^]]"],
			knowledge: {
				conjugationClass: ["Strong"],
				morphologicalTree: {
					root: {
						children: [
							{
								nodeKind: "morphemeReading",
								reading: {
									emojiDescription: "⬆️",
									lemma: aufPrefix,
									unitKind: "Reading",
								},
							},
							{
								children: [
									{
										nodeKind: "unitShadow",
										unitShadow: {
											canonicalForm: "stehen",
											family: "Lexeme",
											kind: "VERB",
											language: "de",
										},
									},
								],
								nodeKind: "structure",
							},
						],
						nodeKind: "structure",
					},
				},
				preterite: ["stand auf"],
				translations: { en: ["get up", "stand up"] },
				valency: [
					{
						complements: [
							{
								governedCase: "Acc",
								kind: "Preposition",
								preposition: fuer,
								referent: "Either",
							},
						],
						status: "Optional",
					},
				],
			},
		}),
	],
};

// Locution.

const insGrasBeissen: Lemma<"Locution", "VERB"> = {
	canonicalForm: "ins Gras beißen",
	coreFeatures: {},
	family: "Locution",
	kind: "VERB",
	language: "de",
	unitKind: "Lemma",
};

const locutionData: LemmaNoteData<De> = {
	lemmaRecord: { lemma: insGrasBeissen },
	ownedSurfaceEntries: [],
	pendingRelations: [],
	readingEntries: [
		readingEntry(reading(insGrasBeissen, "💀"), {
			knowledge: {
				locutionType: "Idiom",
				translations: { en: ["bite the dust"] },
			},
		}),
	],
};

// Saying.

const morgenstund: Lemma<"Saying", "Saying"> = {
	canonicalForm: "Morgenstund hat Gold im Mund",
	coreFeatures: {},
	family: "Saying",
	kind: "Saying",
	language: "de",
	unitKind: "Lemma",
};

const sayingData: LemmaNoteData<De> = {
	lemmaRecord: { lemma: morgenstund },
	ownedSurfaceEntries: [],
	pendingRelations: [],
	readingEntries: [
		readingEntry(reading(morgenstund, "🌅"), {
			knowledge: {
				sayingType: { type: "Proverb" },
				translations: { en: ["the early bird catches the worm"] },
			},
		}),
	],
};

// Morpheme.

const morphemeData: LemmaNoteData<De> = {
	lemmaRecord: { lemma: aufPrefix },
	ownedSurfaceEntries: [],
	pendingRelations: [],
	readingEntries: [
		readingEntry(reading(aufPrefix, "⬆️"), {
			knowledge: { translations: { en: ["up"] } },
		}),
	],
};

// Foreign Lemma: one Reading, no Emoji Description.

const foreignLemma: Lemma<"Foreign", "Foreign"> = {
	canonicalForm: "c'est la vie",
	coreFeatures: { sourceLang: "fr" },
	family: "Foreign",
	kind: "Foreign",
	language: "de",
	unitKind: "Lemma",
};

export const foreignData: LemmaNoteData<De> = {
	lemmaRecord: { lemma: foreignLemma },
	ownedSurfaceEntries: [],
	pendingRelations: [],
	readingEntries: [
		readingEntry(
			{ lemma: foreignLemma, unitKind: "Reading" } as Dumling.Reading<De>,
			{ knowledge: { translations: { en: ["that's life"] } } },
		),
	],
};

// Pronoun Syncretism: ihm, which er and es share.

function ihmOf(gender: "Masc" | "Neut"): Lemma<"Lexeme", "PRON"> {
	return {
		canonicalForm: "ihm",
		coreFeatures: {
			case: "Dat",
			gender,
			number: "Sing",
			person: "3",
			polite: null,
			poss: null,
			pronType: "Prs",
		},
		family: "Lexeme",
		kind: "PRON",
		language: "de",
		unitKind: "Lemma",
	};
}

const ihmMasc = ihmOf("Masc");
const ihmSyncretism = syncretize([ihmOf("Masc"), ihmOf("Neut")]);

export const syncretismData: LemmaNoteData<De> = {
	lemmaRecord: { lemma: ihmSyncretism },
	ownedSurfaceEntries: [],
	pendingRelations: [],
	readingEntries: [
		readingEntry(reading(ihmSyncretism, "👤"), {
			knowledge: {
				// Reading target mode: an exact Reading of another Lemma.
				semanticRelations: {
					synonym: [reading(ihmMasc, "👨")],
					targetKind: "reading",
				},
				translations: { en: ["him", "it"] },
			},
		}),
	],
};

export const familyFixtures = {
	foreign: foreignData,
	locution: locutionData,
	morpheme: morphemeData,
	noun: nounData,
	saying: sayingData,
	syncretism: syncretismData,
	verb: verbData,
} as const;
