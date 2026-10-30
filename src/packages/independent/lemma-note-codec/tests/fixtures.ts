import {
	type AttestationLink,
	makeSurfaceId,
	type ReadingEntry,
	type SurfaceEntry,
} from "dumdict";
import { createPendingSemanticRelationRecord } from "dumdict/pending";
import { lemmaIdentityKey, syncretize } from "dumling";
import type * as Dumling from "dumling/types";
import { applyParadigmChanges, paradigmChangesFor } from "dumrel";
import type * as Dumrel from "dumrel/types";
import type { LemmaRecords } from "../src";

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
		attestationLinks: [],
		attestedTranslations: [],
		notes: "",
		reading,
		...content,
	};
}

/**
 * An Attestation Link of `ref` to `reading`, with the Surface it realized:
 * by default one no fixture owns, as the codec stores an id as given.
 */
function link(
	ref: string,
	reading: Dumling.Reading<De>,
	surface?: Dumling.Surface<De>,
): AttestationLink<De> {
	return {
		reading,
		ref,
		surfaceId:
			surface === undefined
				? unownedSurfaceId(reading)
				: makeSurfaceId("de", surface),
	};
}

/**
 * A Surface id for a ref whose Surface no fixture owns. dumdict reads only
 * the Lemma an id names, which must be the Reading's.
 */
export const unownedSurfaceId = (reading: Dumling.Reading<De>) =>
	JSON.stringify({
		lemma: lemmaIdentityKey(reading.lemma),
		normalizedSurface: reading.lemma.canonicalForm,
	}) as SurfaceEntry<De>["id"];

/** A Lemma Paradigm from the forms each Reading licenses per dimension. */
function paradigmOf(
	lemma: Dumling.Lemma<De>,
	licences: readonly {
		readonly reading: Dumling.Reading<De>;
		readonly dimension: Dumrel.DimensionId;
		readonly values: readonly string[];
	}[],
): Dumrel.LemmaParadigm {
	const result = applyParadigmChanges({
		changes: licences.flatMap((licence) =>
			paradigmChangesFor({ ...licence, provenance: "Produced" }),
		),
		lemma,
		paradigm: { dimensions: {} },
		readings: [...new Set(licences.map(({ reading }) => reading))],
	});
	if (!result.success) throw result.error;
	return result.value;
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

export const mutterParent = reading(mutter, "👩");
export const mutterNut = reading(mutter, "🔩");

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

export const nounData: LemmaRecords<De> = {
	lemmaRecord: {
		lemma: mutter,
		// Two Licence Groups: 👩 Mütter, 🔩 Muttern (ADR 0038).
		paradigm: paradigmOf(mutter, [
			{ dimension: "plural", reading: mutterParent, values: ["Mütter"] },
			{ dimension: "plural", reading: mutterNut, values: ["Muttern"] },
		]),
	},
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
			attestationLinks: [
				link("![[Scroll#^3|^]]", mutterParent, muetterSurface),
				link("![[Other Scroll#^7|^]]", mutterParent),
			],
			attestedTranslations: ["mother"],
			knowledge: {
				definition: "A female parent; 100% of the time %% loved.",
				semanticRelations: { synonym: [mama], targetKind: "lemma" },
				transcription: "ˈmʊtɐ",
				translations: {
					en: [[{ kind: "Text", text: "mother" }]],
					ru: [
						[{ kind: "Text", text: "мать" }],
						[{ kind: "Text", text: "мама" }],
					],
				},
			},
			notes: "First line\n\nSecond paragraph with %%tf:identity {}%% inside.",
		}),
		readingEntry(mutterNut, {
			knowledge: {
				translations: { en: [[{ kind: "Text", text: "nut" }]] },
			},
		}),
	],
};

// Separable VERB with a Valency Frame.

const aufstehen: Lemma<"Lexeme", "VERB"> = {
	canonicalForm: "aufstehen",
	coreFeatures: { hasSepPrefix: "auf" },
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

export const verbData: LemmaRecords<De> = {
	lemmaRecord: { lemma: aufstehen },
	ownedSurfaceEntries: [],
	pendingRelations: [],
	readingEntries: [
		readingEntry(reading(aufstehen, "🛏️"), {
			attestationLinks: [
				link("![[Morgen#^2|^]]", reading(aufstehen, "🛏️")),
			],
			knowledge: {
				translations: {
					en: [
						[{ kind: "Text", text: "get up" }],
						[{ kind: "Text", text: "stand up" }],
					],
				},
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

const locutionData: LemmaRecords<De> = {
	lemmaRecord: { lemma: insGrasBeissen },
	ownedSurfaceEntries: [],
	pendingRelations: [],
	readingEntries: [
		readingEntry(reading(insGrasBeissen, "💀"), {
			knowledge: {
				locutionType: "Idiom",
				translations: {
					en: [[{ kind: "Text", text: "bite the dust" }]],
				},
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

const sayingData: LemmaRecords<De> = {
	lemmaRecord: { lemma: morgenstund },
	ownedSurfaceEntries: [],
	pendingRelations: [],
	readingEntries: [
		readingEntry(reading(morgenstund, "🌅"), {
			knowledge: {
				sayingType: { type: "Proverb" },
				translations: {
					en: [
						[
							{
								kind: "Text",
								text: "the early bird catches the worm",
							},
						],
					],
				},
			},
		}),
	],
};

// Morpheme.

const morphemeData: LemmaRecords<De> = {
	lemmaRecord: { lemma: aufPrefix },
	ownedSurfaceEntries: [],
	pendingRelations: [],
	readingEntries: [
		readingEntry(reading(aufPrefix, "⬆️"), {
			knowledge: {
				translations: { en: [[{ kind: "Text", text: "up" }]] },
			},
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

const foreignData: LemmaRecords<De> = {
	lemmaRecord: { lemma: foreignLemma },
	ownedSurfaceEntries: [],
	pendingRelations: [],
	readingEntries: [
		readingEntry(
			{ lemma: foreignLemma, unitKind: "Reading" } as Dumling.Reading<De>,
			{
				knowledge: {
					translations: {
						en: [[{ kind: "Text", text: "that's life" }]],
					},
				},
			},
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

const syncretismData: LemmaRecords<De> = {
	lemmaRecord: { lemma: ihmSyncretism },
	ownedSurfaceEntries: [],
	pendingRelations: [],
	readingEntries: [
		readingEntry(reading(ihmSyncretism, "👤"), {
			knowledge: {
				// Reading target mode: an exact Reading of another Lemma, whose
				// `♂️` dumdict stores without its variation selector.
				semanticRelations: {
					synonym: [reading(ihmMasc, "♂️")],
					targetKind: "reading",
				},
				translations: {
					en: [
						[{ kind: "Text", text: "him" }],
						[{ kind: "Text", text: "it" }],
					],
				},
			},
		}),
	],
};

// VERB with a Free dimension: melken takes molk and melkte in every sense.

const melken: Lemma<"Lexeme", "VERB"> = {
	canonicalForm: "melken",
	coreFeatures: { hasSepPrefix: null },
	family: "Lexeme",
	kind: "VERB",
	language: "de",
	unitKind: "Lemma",
};
const melkenCow = reading(melken, "🐄");
const melkenProfit = reading(melken, "💰");

const melkenData: LemmaRecords<De> = {
	lemmaRecord: {
		lemma: melken,
		paradigm: paradigmOf(melken, [
			{
				dimension: "preterite",
				reading: melkenCow,
				values: ["molk", "melkte"],
			},
			{
				dimension: "preterite",
				reading: melkenProfit,
				values: ["molk", "melkte"],
			},
		]),
	},
	ownedSurfaceEntries: [],
	pendingRelations: [],
	readingEntries: [
		readingEntry(melkenCow, {
			knowledge: {
				translations: { en: [[{ kind: "Text", text: "milk" }]] },
			},
		}),
		readingEntry(melkenProfit, {
			knowledge: {
				translations: { en: [[{ kind: "Text", text: "fleece" }]] },
			},
		}),
	],
};

// VERB with partial overlap: 📨 senden takes sandte and sendete, 📺 only sendete.

const senden: Lemma<"Lexeme", "VERB"> = {
	canonicalForm: "senden",
	coreFeatures: { hasSepPrefix: null },
	family: "Lexeme",
	kind: "VERB",
	language: "de",
	unitKind: "Lemma",
};
export const sendenMail = reading(senden, "📨");
export const sendenBroadcast = reading(senden, "📺");

const sendenData: LemmaRecords<De> = {
	lemmaRecord: {
		lemma: senden,
		paradigm: paradigmOf(senden, [
			{
				dimension: "preterite",
				reading: sendenMail,
				values: ["sandte", "sendete"],
			},
			{
				dimension: "preterite",
				reading: sendenBroadcast,
				values: ["sendete"],
			},
		]),
	},
	ownedSurfaceEntries: [],
	pendingRelations: [],
	readingEntries: [
		readingEntry(sendenMail, {
			knowledge: {
				translations: { en: [[{ kind: "Text", text: "send" }]] },
			},
		}),
		readingEntry(sendenBroadcast, {
			knowledge: {
				translations: { en: [[{ kind: "Text", text: "broadcast" }]] },
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

/** Lemmas whose Readings form one, two or overlapping Licence Groups. */
export const licenceFixtures = {
	melken: melkenData,
	mutter: nounData,
	senden: sendenData,
} as const;
