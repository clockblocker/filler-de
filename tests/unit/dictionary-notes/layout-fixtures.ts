import type { LemmaRecords } from "@textfresser/lemma-note-codec";
import { makeSurfaceId, type ReadingEntry, type SurfaceEntry } from "dumdict";
import type * as Dumling from "dumling/types";
import { applyParadigmChanges, paradigmChangesFor } from "dumrel";
import type * as Dumrel from "dumrel/types";

/**
 * The user's dictionary examples (#49, #103, #104) as records: a noun with
 * relations and morphemes, a strong verb, and Mutter with two Licence
 * Groups.
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
	} = {},
): ReadingEntry<"de"> {
	const { refs = [], ...rest } = content;
	return {
		attestationLinks: refs.map((ref) => ({ reading, ref, surfaceId: null })),
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
