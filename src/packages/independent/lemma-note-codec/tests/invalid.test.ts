import { describe, expect, it } from "bun:test";
import type * as Dumling from "dumling/types";
import { Result } from "effect";
import {
	type LemmaNoteMetadata,
	notePathsOf,
	parseLemmaNote,
	parseReadingNote,
	type ReadingNoteMetadata,
	serializeLemmaNote,
	serializeReadingNote,
} from "../src";
import { mutter, mutterParent, nounData } from "./fixtures";
import { issueTags } from "./helpers";

const lemma = Result.getOrThrow(serializeLemmaNote(nounData));
const reading = Result.getOrThrow(serializeReadingNote(nounData, mutterParent));

const parseLemma = (metadata: unknown, body = lemma.body) =>
	parseLemmaNote(
		{ body, metadata: metadata as LemmaNoteMetadata },
		{ language: "de" },
	);
const parseReading = (metadata: unknown, body = reading.body) =>
	parseReadingNote(
		{ body, metadata: metadata as ReadingNoteMetadata },
		{ language: "de" },
	);

const MARKER_NOTE = "%%tf-part:lemma%%\n%%tf:identity {}%%\n\nmy notes\n";

describe("notes that hold no valid records come back as typed issues", () => {
	it("a note without metadata of its kind", () => {
		expect(issueTags(parseLemma(undefined).data)).toEqual([
			"MissingMetadata",
		]);
		expect(issueTags(parseReading(undefined).data)).toEqual([
			"MissingMetadata",
		]);
	});

	it("a note in the retired marker format, read as freeform and never as data", () => {
		const parsed = parseLemma(undefined, MARKER_NOTE);
		expect(issueTags(parsed.data)).toEqual([
			"LegacyMarkerFormat",
			"MissingMetadata",
		]);
		expect(parsed.document.segments).toMatchObject([
			{ text: MARKER_NOTE.trimEnd(), type: "freeform" },
		]);
		expect(issueTags(parseReading(undefined, MARKER_NOTE).data)).toContain(
			"LegacyMarkerFormat",
		);
	});

	it("a Lemma dumdict rejects", () => {
		const result = parseLemma({
			...lemma.metadata,
			lemma: { canonicalForm: "x" },
		}).data;
		expect(issueTags(result)).toEqual(["InvalidRecord"]);
		if (result.ok) throw new Error("invalid");
		expect(result.issues[0]).toMatchObject({
			at: { field: "lemma" },
			record: "LemmaRecord",
		});
	});

	it("a Lemma Paradigm dumdict rejects", () => {
		expect(
			issueTags(
				parseLemma({
					...lemma.metadata,
					paradigm: { dimensions: { plural: {} } },
				}).data,
			),
		).toEqual(["InvalidRecord"]);
	});

	it("an owned Surface of another Lemma, or one Surface twice", () => {
		const [surface] = lemma.metadata.surfaces;
		if (!surface) throw new Error("fixture");
		const other: Dumling.Lemma<"de"> = {
			...mutter,
			canonicalForm: "Vater",
			coreFeatures: { gender: "Masc" },
		};
		const foreign = {
			...surface,
			surface: {
				...(surface.surface as object),
				lemma: other,
				normalizedSurface: "Väter",
			},
		};
		// dumdict's own parser holds a Surface to its owner Lemma.
		const result = parseLemma({
			...lemma.metadata,
			surfaces: [foreign],
		}).data;
		expect(issueTags(result)).toEqual(["InvalidRecord"]);
		expect(
			issueTags(
				parseLemma({ ...lemma.metadata, surfaces: [surface, surface] })
					.data,
			),
		).toEqual(["InconsistentRecord"]);
	});

	it("a Reading Entry or a pending relation dumdict rejects", () => {
		expect(
			issueTags(
				parseReading({
					...reading.metadata,
					reading: { unitKind: "Reading" },
				}).data,
			),
		).toEqual(["InvalidRecord"]);
		expect(
			issueTags(
				parseReading({
					...reading.metadata,
					knowledge: { translations: "not a map" },
				}).data,
			),
		).toEqual(["InvalidRecord"]);
		const result = parseReading({
			...reading.metadata,
			pendingRelations: [{ relation: "cousin", target: {} }],
		}).data;
		expect(issueTags(result)).toEqual(["InvalidRecord"]);
		if (result.ok) throw new Error("invalid");
		expect(result.issues[0]).toMatchObject({
			at: { field: "pendingRelations", index: 0 },
			record: "PendingSemanticRelationRecord",
		});
	});

	it("a note written before the batteries moved reflexivity to the frame and translations to pieces", () => {
		// filler-de #65 resets such notes; until then each reads as a typed
		// issue and the note stays as it is.
		const reflexive: Dumling.Lemma<"de"> = {
			canonicalForm: "schämen",
			coreFeatures: { hasSepPrefix: null, lexicallyReflexive: "Acc" },
			family: "Lexeme",
			kind: "VERB",
			language: "de",
			unitKind: "Lemma",
		} as unknown as Dumling.Lemma<"de">;
		expect(
			issueTags(parseLemma({ ...lemma.metadata, lemma: reflexive }).data),
		).toEqual(["InvalidRecord"]);
		expect(
			issueTags(
				parseReading({
					...reading.metadata,
					knowledge: { translations: { en: ["mother"] } },
				}).data,
			),
		).toEqual(["InvalidRecord"]);
		expect(
			issueTags(
				parseReading({
					...reading.metadata,
					knowledge: {
						morphologicalTree: {
							root: { children: [], nodeKind: "structure" },
						},
					},
				}).data,
			),
		).toEqual(["InvalidRecord"]);
		expect(
			issueTags(
				parseReading({
					...reading.metadata,
					attestationLinks: [
						{ ref: "![[Scroll#^1|^]]", surfaceId: null },
					],
				}).data,
			),
		).toEqual(["InvalidMetadata"]);
	});

	it("never reads the visible lines: a note whose body lost everything keeps its data", () => {
		const parsed = parseReading(reading.metadata, "");
		expect(parsed.data.ok).toBe(true);
		expect(parsed.document.segments).toEqual([]);
	});

	it("metadata that is not its kind's shape", () => {
		expect(
			issueTags(parseLemma({ ...lemma.metadata, surfaces: null }).data),
		).toEqual(["InvalidMetadata"]);
		expect(
			issueTags(
				parseReading({ ...reading.metadata, rendering: "x" }).data,
			),
		).toEqual(["InvalidMetadata"]);
	});

	it("never throws on arbitrary metadata", () => {
		const values: unknown[] = [
			null,
			3,
			"x",
			[],
			{},
			[null],
			{ nodeKind: "?" },
		];
		for (const field of ["lemma", "paradigm", "surfaces", "rendering"])
			for (const value of values)
				expect(() =>
					parseLemma({ ...lemma.metadata, [field]: value }),
				).not.toThrow();
		for (const field of [
			"reading",
			"knowledge",
			"attestationLinks",
			"pendingRelations",
			"notes",
		])
			for (const value of values)
				expect(() =>
					parseReading({ ...reading.metadata, [field]: value }),
				).not.toThrow();
	});
});

describe("path collisions among a Lemma's notes", () => {
	it("reports two Readings whose names toNameSegment spells alike, and paths otherwise", () => {
		const keycaps = ["#️⃣", "*️⃣"].map(
			(emojiDescription) =>
				({
					emojiDescription,
					lemma: mutter,
					unitKind: "Reading",
				}) as Dumling.Reading<"de">,
		);
		const paths = notePathsOf({
			lemmaRecord: { lemma: mutter },
			readingEntries: keycaps.map((r) => ({ reading: r })),
		});
		expect(paths.collisions).toHaveLength(1);
		expect(paths.collisions[0]).toMatchObject({ component: "file" });
		expect(notePathsOf(nounData).collisions).toEqual([]);
		expect(notePathsOf(nounData).lemma.path).toBe(
			"Worter/de/Lexeme/NOUN/Fem/m/mut/mutte/Mutter.md",
		);
		expect(
			[...notePathsOf(nounData).readings.values()].map(
				({ path }) => path,
			),
		).toEqual([
			"Worter/de/Lexeme/NOUN/Fem/m/mut/mutte/👩 Mutter.md",
			"Worter/de/Lexeme/NOUN/Fem/m/mut/mutte/🔩 Mutter.md",
		]);
	});
});
