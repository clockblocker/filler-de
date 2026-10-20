import {
	makeSurfaceId,
	type PendingSemanticRelationRecord,
	type PlannedChangeOp,
	type ReadingEntry,
	type SurfaceEntry,
} from "dumdict";
import { createPendingSemanticRelationRecord } from "dumdict/pending";
import type * as Dumling from "dumling/types";

type Verb = Dumling.Lemma<"de", "Lexeme", "VERB">;

export function verb(canonicalForm: string): Verb {
	return {
		canonicalForm,
		coreFeatures: { hasSepPrefix: null, lexicallyReflexive: null },
		family: "Lexeme",
		kind: "VERB",
		language: "de",
		unitKind: "Lemma",
	};
}

export const readingOf = (
	lemma: Verb,
	emojiDescription: string,
): Dumling.Reading<"de", "Lexeme", "VERB"> => ({
	emojiDescription,
	lemma,
	unitKind: "Reading",
});

export const gehen = verb("gehen");
export const laufen = verb("laufen");
export const springen = verb("springen");
export const schreiten = verb("schreiten");
export const gehenReading = readingOf(gehen, "🚶");
export const laufenReading = readingOf(laufen, "🏃");
export const springenReading = readingOf(springen, "🦘");
export const schreitenReading = readingOf(schreiten, "🦶");

const gehtSurface: Dumling.Surface<"de", "Lexeme", "VERB"> = {
	inflectionalFeatures: null,
	language: "de",
	lemma: gehen,
	normalizedSurface: "Geht",
	spelling: { kind: "Canonical" },
	surfaceFeatures: null,
	unitKind: "Surface",
};

export const gehtSurfaceEntry: SurfaceEntry<"de"> = {
	attestations: [],
	attestedTranslations: ["goes"],
	id: makeSurfaceId("de", gehtSurface),
	notes: "",
	ownerLemma: gehen,
	surface: gehtSurface,
};

export function readingEntry(
	reading: Dumling.Reading<"de">,
	content: Partial<Omit<ReadingEntry<"de">, "reading">> = {},
): ReadingEntry<"de"> {
	return {
		attestations: [],
		attestedTranslations: [],
		notes: "",
		reading,
		...content,
	};
}

export const schreitenShadow = {
	relation: "synonym",
	target: {
		canonicalForm: "schreiten",
		family: "Lexeme",
		kind: "VERB",
		language: "de",
	},
} as const;

export const pendingFrom = (
	reading: Dumling.Reading<"de">,
): PendingSemanticRelationRecord<"de"> =>
	createPendingSemanticRelationRecord(reading, schreitenShadow);

export const createLemma = (
	lemma: Dumling.Lemma<"de">,
): PlannedChangeOp<"de"> => ({
	preconditions: [{ kind: "lemmaMissing", lemma }],
	record: { lemma },
	type: "createLemma",
});

export const createReading = (
	entry: ReadingEntry<"de">,
): PlannedChangeOp<"de"> => ({
	entry,
	preconditions: [],
	type: "createReading",
});

export const createSurface = (
	entry: SurfaceEntry<"de">,
): PlannedChangeOp<"de"> => ({
	entry,
	preconditions: [],
	type: "createOwnedSurface",
});

export const createPending = (
	record: PendingSemanticRelationRecord<"de">,
): PlannedChangeOp<"de"> => ({
	preconditions: [],
	record,
	type: "createPendingSemanticRelation",
});

export const addAttestation = (
	reading: Dumling.Reading<"de">,
	value: string,
): PlannedChangeOp<"de"> => ({
	ops: [{ kind: "addAttestation", value }],
	preconditions: [],
	reading,
	type: "patchReading",
});

export const contribute = (
	reading: Dumling.Reading<"de">,
	definition: string,
): PlannedChangeOp<"de"> => ({
	ops: [
		{
			envelope: {
				change: {
					aspect: "definition",
					kind: "Contribute",
					value: definition,
				},
				reading,
			},
			kind: "applyKnowledgeChange",
		},
	],
	preconditions: [],
	reading,
	type: "patchReading",
});

export const synonym = (
	reading: Dumling.Reading<"de">,
	target: Dumling.Lemma<"de">,
): PlannedChangeOp<"de"> => ({
	ops: [
		{
			envelope: {
				change: {
					aspect: "semanticRelations",
					kind: "Contribute",
					relation: "synonym",
					value: [target],
				},
				reading,
			},
			kind: "applyKnowledgeChange",
		},
	],
	preconditions: [],
	reading,
	type: "patchReading",
});
