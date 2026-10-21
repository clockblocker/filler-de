import type { LemmaRecords } from "@textfresser/lemma-note-codec";
import { authoredMembers } from "dumcorpus/inventories";
import { makeSurfaceId, type ReadingEntry, type SurfaceEntry } from "dumdict";
import type * as Dumling from "dumling/types";
import { applyParadigmChanges, paradigmChangesFor } from "dumrel";
import type * as Dumrel from "dumrel/types";

/**
 * The user's dictionary examples (#49, #103, #104) as records: a noun with
 * relations and morphemes, a strong verb, and Mutter with two Licence
 * Groups; and the tables of the German Inflection Pack (#120): a separable
 * verb, a Free verb, a comparable adjective and a determiner stem.
 */

const shadow = (canonicalForm: string) => ({
	nodeKind: "unitShadow" as const,
	unitShadow: {
		canonicalForm,
		family: "Lexeme" as const,
		kind: "NOUN" as const,
		language: "de" as const,
	},
});

const noun = (
	canonicalForm: string,
	gender: "Fem" | "Masc" | "Neut",
): Dumling.Lemma<"de", "Lexeme", "NOUN"> => ({
	canonicalForm,
	coreFeatures: { gender },
	family: "Lexeme",
	kind: "NOUN",
	language: "de",
	unitKind: "Lemma",
});

const readingOf = (
	lemma: Dumling.Lemma<"de">,
	emojiDescription: string,
): Dumling.Reading<"de"> =>
	({ emojiDescription, lemma, unitKind: "Reading" }) as Dumling.Reading<"de">;

function entry(
	reading: Dumling.Reading<"de">,
	content: Partial<Omit<ReadingEntry<"de">, "attestationLinks" | "reading">> & {
		readonly refs?: readonly string[];
		/** Refs whose occurrence spells an owned Surface, by its id. */
		readonly met?: readonly (readonly [string, SurfaceEntry<"de">["id"]])[];
	} = {},
): ReadingEntry<"de"> {
	const { met = [], refs = [], ...rest } = content;
	return {
		attestationLinks: [
			...refs.map((ref) => ({ reading, ref, surfaceId: null })),
			...met.map(([ref, surfaceId]) => ({ reading, ref, surfaceId })),
		],
		attestedTranslations: [],
		notes: "",
		reading,
		...rest,
	};
}

function surfaceOf(
	lemma: Dumling.Lemma<"de">,
	normalizedSurface: string,
	inflectionalFeatures: Record<string, string | null>,
): SurfaceEntry<"de"> {
	const surface = {
		inflectionalFeatures,
		language: "de",
		lemma,
		normalizedSurface,
		spelling: { kind: "Canonical" },
		surfaceFeatures: null,
		unitKind: "Surface",
	} as unknown as Dumling.Surface<"de">;
	return {
		attestations: [],
		attestedTranslations: [],
		id: makeSurfaceId("de", surface),
		notes: "",
		ownerLemma: lemma,
		surface,
	};
}

function paradigmOf(
	lemma: Dumling.Lemma<"de">,
	licences: readonly {
		readonly reading: Dumling.Reading<"de">;
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

const kohlekraftwerkLemma = noun("Kohlekraftwerk", "Neut");
export const kohlekraftwerkReading = readingOf(kohlekraftwerkLemma, "🏭");

export const kohlekraftwerk: LemmaRecords<"de"> = {
	lemmaRecord: {
		lemma: kohlekraftwerkLemma,
		paradigm: paradigmOf(kohlekraftwerkLemma, [
			{
				dimension: "plural",
				reading: kohlekraftwerkReading,
				values: ["Kohlekraftwerke"],
			},
		]),
	},
	ownedSurfaceEntries: [
		surfaceOf(kohlekraftwerkLemma, "Kohlekraftwerken", {
			case: "Dat",
			gender: null,
			number: "Plur",
		}),
	],
	pendingRelations: [],
	readingEntries: [
		entry(kohlekraftwerkReading, {
			knowledge: {
				morphologicalTree: {
					root: {
						children: [
							shadow("Kohle"),
							{
								children: [shadow("Kraft"), shadow("Werk")],
								nodeKind: "structure",
							},
						],
						nodeKind: "structure",
					},
				},
				semanticRelations: {
					antonym: [noun("Windrad", "Neut")],
					nearSynonym: [noun("Industrieanlage", "Fem"), noun("Fabrik", "Fem")],
					synonym: [noun("Kraftwerk", "Neut")],
					targetKind: "lemma",
				},
				transcription: "ˈkoːləˌkraftvɛɐ̯k",
				translations: { en: ["coal-fired power plant"] },
			},
			refs: ["![[Atom#^13|^]]", "![[Atom#^14|^]]"],
		}),
	],
};

const fahrenLemma: Dumling.Lemma<"de", "Lexeme", "VERB"> = {
	canonicalForm: "fahren",
	coreFeatures: { hasSepPrefix: null, lexicallyReflexive: null },
	family: "Lexeme",
	kind: "VERB",
	language: "de",
	unitKind: "Lemma",
};
export const fahrenReading = readingOf(fahrenLemma, "🚗");

/** The principal parts texteater#1218 stored for fahren (dumcorpus gold). */
export const fahren: LemmaRecords<"de"> = {
	lemmaRecord: {
		lemma: fahrenLemma,
		paradigm: paradigmOf(
			fahrenLemma,
			(
				[
					["preterite", "fuhr"],
					["present1", "fahre"],
					["present2", "fährst"],
					["present3", "fährt"],
					["pastParticiple", "gefahren"],
					["subjunctivePast", "führe"],
				] as const
			).map(([dimension, value]) => ({
				dimension,
				reading: fahrenReading,
				values: [value],
			})),
		),
	},
	ownedSurfaceEntries: [],
	pendingRelations: [],
	readingEntries: [
		entry(fahrenReading, {
			attestedTranslations: ["drive", "drove"],
			knowledge: {
				transcription: "ˈfaːʁən",
				translations: { en: ["drive", "ride", "go"] },
			},
			refs: ["![[Ankunft#^3|^]]"],
		}),
	],
};

const mutterLemma = noun("Mutter", "Fem");
export const mutterParent = readingOf(mutterLemma, "👩");
export const mutterNut = readingOf(mutterLemma, "🔩");

export const mutter: LemmaRecords<"de"> = {
	lemmaRecord: {
		lemma: mutterLemma,
		paradigm: paradigmOf(mutterLemma, [
			{ dimension: "plural", reading: mutterParent, values: ["Mütter"] },
			{ dimension: "plural", reading: mutterNut, values: ["Muttern"] },
		]),
	},
	ownedSurfaceEntries: [
		surfaceOf(mutterLemma, "Mütter", { case: "Nom", gender: null, number: "Plur" }),
		surfaceOf(mutterLemma, "Muttern", { case: "Acc", gender: null, number: "Plur" }),
	],
	pendingRelations: [],
	readingEntries: [
		entry(mutterParent, {
			knowledge: {
				transcription: "ˈmʊtɐ",
				translations: { en: ["mother"] },
			},
			refs: ["![[Familie#^2|^]]"],
		}),
		entry(mutterNut, {
			knowledge: { translations: { en: ["nut"] } },
			refs: ["![[Werkstatt#^5|^]]"],
		}),
	],
};

const mutterMet = mutter.ownedSurfaceEntries[1];
if (mutterMet === undefined) throw new Error("Muttern");

/**
 * Mutter with a Licence Conflict: Muttern met in a text judged 👩, whose
 * Licence takes only Mütter.
 */
export const mutterConflict: LemmaRecords<"de"> = {
	...mutter,
	readingEntries: [
		entry(mutterParent, {
			met: [["![[Werkstatt#^9|^]]", mutterMet.id]],
			refs: ["![[Familie#^2|^]]"],
		}),
		entry(mutterNut, { refs: ["![[Werkstatt#^5|^]]"] }),
	],
};

const verb = (
	canonicalForm: string,
	hasSepPrefix: string | null = null,
): Dumling.Lemma<"de", "Lexeme", "VERB"> => ({
	canonicalForm,
	coreFeatures: { hasSepPrefix, lexicallyReflexive: null },
	family: "Lexeme",
	kind: "VERB",
	language: "de",
	unitKind: "Lemma",
});

const PRESENT_3 = {
	expletive: null,
	future: null,
	mood: "Ind",
	number: "Sing",
	passive: null,
	perfect: null,
	person: "3",
	tense: "Pres",
	verbForm: "Fin",
	voice: null,
};

const abfahrenLemma = verb("abfahren", "ab");
export const abfahrenReading = readingOf(abfahrenLemma, "🚉");

/** A separable verb: its finite forms split off their particle after a Gap. */
export const abfahren: LemmaRecords<"de"> = {
	lemmaRecord: {
		lemma: abfahrenLemma,
		paradigm: paradigmOf(
			abfahrenLemma,
			(
				[
					["preterite", "fuhr ab"],
					["present1", "fahre ab"],
					["present2", "fährst ab"],
					["present3", "fährt ab"],
					["pastParticiple", "abgefahren"],
					["subjunctivePast", "führe ab"],
				] as const
			).map(([dimension, value]) => ({
				dimension,
				reading: abfahrenReading,
				values: [value],
			})),
		),
	},
	ownedSurfaceEntries: [surfaceOf(abfahrenLemma, "fährt ab", PRESENT_3)],
	pendingRelations: [],
	readingEntries: [
		entry(abfahrenReading, {
			knowledge: { translations: { en: ["depart", "leave"] } },
			refs: ["![[Bahnhof#^4|^]]"],
		}),
	],
};

const melkenLemma = verb("melken");
export const melkenCow = readingOf(melkenLemma, "🐄");
export const melkenFleece = readingOf(melkenLemma, "💰");

/**
 * melken: every Reading licenses every variant, so the Lemma is Free and
 * has one table, its cells holding both forms (`molk / melkte`).
 */
export const melken: LemmaRecords<"de"> = {
	lemmaRecord: {
		lemma: melkenLemma,
		paradigm: paradigmOf(
			melkenLemma,
			[melkenCow, melkenFleece].flatMap((reading) =>
				(
					[
						["preterite", ["molk", "melkte"]],
						["present1", ["melke"]],
						["present2", ["melkst", "milkst"]],
						["present3", ["melkt", "milkt"]],
						["pastParticiple", ["gemolken", "gemelkt"]],
						["subjunctivePast", ["mölke", "melkte"]],
					] as const
				).map(([dimension, values]) => ({ dimension, reading, values })),
			),
		),
	},
	ownedSurfaceEntries: [surfaceOf(melkenLemma, "molk", { ...PRESENT_3, tense: "Past" })],
	pendingRelations: [],
	readingEntries: [
		entry(melkenCow, { refs: ["![[Hof#^1|^]]"] }),
		entry(melkenFleece, { refs: ["![[Betrug#^7|^]]"] }),
	],
};

const schnellLemma = {
	canonicalForm: "schnell",
	coreFeatures: { comparable: "Yes" },
	family: "Lexeme",
	kind: "ADJ",
	language: "de",
	unitKind: "Lemma",
} as Dumling.Lemma<"de", "Lexeme", "ADJ">;
export const schnellReading = readingOf(schnellLemma, "⚡");

/** A comparable adjective: its comparison comes from the pack's rules alone. */
export const schnell: LemmaRecords<"de"> = {
	lemmaRecord: { lemma: schnellLemma },
	ownedSurfaceEntries: [
		surfaceOf(schnellLemma, "schneller", {
			case: null,
			degree: "Cmp",
			gender: null,
			number: null,
		}),
		surfaceOf(schnellLemma, "schnellen", {
			case: "Dat",
			degree: "Pos",
			gender: "Masc",
			number: "Sing",
		}),
	],
	pendingRelations: [],
	readingEntries: [entry(schnellReading, { refs: ["![[Rennen#^2|^]]"] })],
};

const dieserMember = authoredMembers.find(
	({ lemma }) => lemma.kind === "DET" && lemma.canonicalForm === "dieser",
);
if (dieserMember === undefined) throw new Error("dieser is authored");
const dieserLemma = dieserMember.lemma;
export const dieserReading = readingOf(dieserLemma, "👉");

/** A declining determiner stem: its Authored Inventory's table. */
export const dieser: LemmaRecords<"de"> = {
	lemmaRecord: { lemma: dieserLemma },
	ownedSurfaceEntries: [],
	pendingRelations: [],
	readingEntries: [entry(dieserReading, { refs: ["![[Zeitung#^6|^]]"] })],
};

/** A noun with one 📘 Reading and its one plural, as the vault's generated entries held it. */
export function nounRecords(
	canonicalForm: string,
	gender: "Fem" | "Masc" | "Neut",
	plural: string,
): LemmaRecords<"de"> {
	const lemma = noun(canonicalForm, gender);
	const reading = readingOf(lemma, "📘");
	return {
		lemmaRecord: {
			lemma,
			paradigm: paradigmOf(lemma, [
				{ dimension: "plural", reading, values: [plural] },
			]),
		},
		ownedSurfaceEntries: [],
		pendingRelations: [],
		readingEntries: [entry(reading)],
	};
}
