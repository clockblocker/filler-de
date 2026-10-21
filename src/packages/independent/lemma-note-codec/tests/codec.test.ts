import { describe, expect, it } from "bun:test";
import type { LinkTarget } from "dumdict";
import { createPendingSemanticRelationRecord } from "dumdict/pending";
import type * as Dumling from "dumling/types";
import {
	LemmaNoteMetadataSchema,
	type LemmaRecords,
	ReadingNoteMetadataSchema,
	renderLemmaNote,
	renderReadingNote,
	serializeLemmaNote,
	serializeReadingNote,
} from "../src";
import {
	familyFixtures,
	licenceFixtures,
	mutter,
	nounData,
	verbData,
} from "./fixtures";
import {
	freeformTexts,
	lemmaNoteDataOf,
	parseLemma,
	parseReading,
	readingNoteDataOf,
	valid,
} from "./helpers";

const allFixtures = { ...familyFixtures, ...licenceFixtures };
const readingsOf = (records: LemmaRecords<"de">) =>
	records.readingEntries.map(({ reading }) => reading);

describe("round trips for every German Family", () => {
	for (const [family, records] of Object.entries(allFixtures)) {
		it(`${family}: the Lemma note parses back to its records`, () => {
			const note = serializeLemmaNote(records);
			const parsed = parseLemma(note);
			expect(valid(parsed.data)).toEqual(lemmaNoteDataOf(records));
			expect(freeformTexts(parsed)).toEqual([]);
			// parse → serialize gives the same bytes and metadata.
			expect(
				serializeLemmaNote(records, { previous: parsed.document }),
			).toEqual(note);
		});

		it(`${family}: each Reading note parses back to its records`, () => {
			for (const reading of readingsOf(records)) {
				const note = serializeReadingNote(records, reading);
				const parsed = parseReading(note);
				expect(valid(parsed.data)).toEqual(
					readingNoteDataOf(records, reading),
				);
				expect(freeformTexts(parsed)).toEqual([]);
				expect(
					serializeReadingNote(records, reading, {
						previous: parsed.document,
					}),
				).toEqual(note);
			}
		});

		it(`${family}: rendering twice gives identical bytes, and no marker`, () => {
			expect(renderLemmaNote(records)).toBe(renderLemmaNote(records));
			expect(renderLemmaNote(records)).not.toContain("%%tf");
			for (const reading of readingsOf(records)) {
				expect(renderReadingNote(records, reading)).toBe(
					renderReadingNote(records, reading),
				);
				expect(renderReadingNote(records, reading)).not.toContain(
					"%%tf",
				);
			}
		});

		it(`${family}: the metadata is JSON data its schema accepts`, () => {
			const lemma = serializeLemmaNote(records).metadata;
			expect(JSON.parse(JSON.stringify(lemma))).toEqual(lemma);
			expect(LemmaNoteMetadataSchema.safeParse(lemma).success).toBe(true);
			for (const reading of readingsOf(records)) {
				const metadata = serializeReadingNote(
					records,
					reading,
				).metadata;
				expect(JSON.parse(JSON.stringify(metadata))).toEqual(metadata);
				expect(
					ReadingNoteMetadataSchema.safeParse(metadata).success,
				).toBe(true);
			}
		});
	}

	it("keeps nested Dumling and dumrel values exactly: a tree, a Valency Frame, both target modes", () => {
		const [entry] = verbData.readingEntries;
		if (!entry) throw new Error("fixture");
		const parsed = parseReading(
			serializeReadingNote(verbData, entry.reading),
		);
		// As dumdict normalizes it: `⬆️` loses its variation selector.
		expect(valid(parsed.data).readingEntry.knowledge).toEqual(
			readingNoteDataOf(verbData, entry.reading).readingEntry.knowledge,
		);
		expect(
			JSON.stringify(valid(parsed.data).readingEntry.knowledge),
		).toContain('"nodeKind":"structure"');
		const ihm = familyFixtures.syncretism;
		const [ihmEntry] = ihm.readingEntries;
		if (!ihmEntry) throw new Error("fixture");
		expect(
			valid(
				parseReading(serializeReadingNote(ihm, ihmEntry.reading)).data,
			).readingEntry.knowledge?.semanticRelations,
		).toEqual(ihmEntry.knowledge?.semanticRelations);
	});

	it("keeps Mutter's pending relations, Attestation Links and owned Surface", () => {
		const [parent, nut] = readingsOf(nounData);
		if (!parent || !nut) throw new Error("fixture");
		const parentData = valid(
			parseReading(serializeReadingNote(nounData, parent)).data,
		);
		expect(parentData.pendingRelations).toHaveLength(2);
		expect(parentData.readingEntry.attestationLinks).toEqual(
			nounData.readingEntries[0]?.attestationLinks ?? [],
		);
		expect(
			valid(parseReading(serializeReadingNote(nounData, nut)).data)
				.pendingRelations,
		).toEqual([]);
		expect(
			valid(parseLemma(serializeLemmaNote(nounData)).data)
				.ownedSurfaceEntries,
		).toEqual(nounData.ownedSurfaceEntries);
	});

	it("keeps a resolved Shadow relation's Lemma and shows it through the claim alone", () => {
		const mama = nounData.readingEntries[0]?.knowledge?.semanticRelations;
		const [parent] = readingsOf(nounData);
		if (!parent || !mama) throw new Error("fixture");
		const elternteil: Dumling.Lemma<"de"> = {
			canonicalForm: "Elternteil",
			coreFeatures: { gender: "Masc" },
			family: "Lexeme",
			kind: "NOUN",
			language: "de",
			unitKind: "Lemma",
		};
		const records: LemmaRecords<"de"> = {
			...nounData,
			pendingRelations: nounData.pendingRelations.map((record) =>
				record.pending.target.canonicalForm === "Elternteil"
					? { ...record, resolvedLemma: elternteil }
					: record,
			),
		};
		const note = serializeReadingNote(records, parent);
		expect(
			valid(parseReading(note).data).pendingRelations.find(
				({ pending }) => pending.target.canonicalForm === "Elternteil",
			)?.resolvedLemma,
		).toEqual(elternteil);
		// The pending line is gone; the claim, which dumdict writes beside
		// the resolution, is the only place it shows.
		expect(note.body).not.toContain("Elternteil");
	});

	it("keeps %, links and marker-like text inside the data out of the visible lines' way", () => {
		const [parent] = readingsOf(nounData);
		if (!parent) throw new Error("fixture");
		const note = serializeReadingNote(nounData, parent);
		const { readingEntry } = valid(parseReading(note).data);
		expect(readingEntry.notes).toBe(
			nounData.readingEntries[0]?.notes ?? "",
		);
		expect(readingEntry.knowledge?.definition).toBe(
			"A female parent; 100% of the time %% loved.",
		);
		// `%%` would open an Obsidian comment in visible text.
		expect(note.body).not.toContain("%%");
		// Each Attestation embed shows once, in Deine Kontexte.
		expect(note.body.split("![[Scroll#^3|^]]")).toHaveLength(2);
	});
});

describe("links render the resolution the caller holds", () => {
	const [parent] = readingsOf(nounData);
	const [aufstehen] = readingsOf(verbData);
	if (!parent || !aufstehen) throw new Error("fixture");

	it("by default: Lemma claims at Lemma notes, Shadows and Lemma notes' own spelling at Crossroads", () => {
		const body = renderReadingNote(nounData, parent);
		// The header links the note's own Lemma note.
		expect(body.split("\n")[0]).toContain(
			"[[Worter/de/Lexeme/NOUN/Fem/m/mut/mutte/Mutter|Mutter]]",
		);
		// A direct claim names a stored Lemma; a pending relation only a Shadow.
		expect(body).toContain(
			"= [[Worter/de/Lexeme/NOUN/Fem/m/mam/mama/Mama|Mama]]",
		);
		expect(body).toContain("≠ [[Worter/v/vat/vater/vater|Vater]]");
		expect(body).toContain(
			"⊃ [[Worter/e/elt/elter/elternteil|Elternteil]]",
		);
		// The Lemma note's header names its spelling, sense unknown.
		expect(renderLemmaNote(nounData).split("\n")[0]).toBe(
			"die [[Worter/m/mut/mutte/mutter|Mutter]]",
		);
		// A Lemma note links each of its own Reading notes.
		expect(renderLemmaNote(nounData)).toContain(
			"[[Worter/de/Lexeme/NOUN/Fem/m/mut/mutte/👩 Mutter|👩]]",
		);
	});

	it("by default: an exact morphemeReading at its Reading note, a morpheme Shadow and a preposition at Crossroads", () => {
		const body = renderReadingNote(verbData, aufstehen);
		expect(body).toContain(
			"[[Worter/de/Morpheme/Prefix/auf/a/auf/auf/⬆ auf|auf]]|[[Worter/s/ste/stehe/stehen|stehen]]",
		);
		expect(body).toContain("[[Worter/f/für/für/für|für]] + Acc");
	});

	it("renders every LinkTarget kind a resolver answers", () => {
		const targets: LinkTarget<"de">[] = [];
		const resolve = (target: LinkTarget<"de">) => () => target;
		const lemmaTarget: LinkTarget<"de"> = { kind: "Lemma", lemma: mutter };
		const readingTarget: LinkTarget<"de"> = {
			kind: "Reading",
			reading: parent,
		};
		const spelling: LinkTarget<"de"> = {
			key: "mutter",
			kind: "Spelling",
			language: "de",
		};
		targets.push(lemmaTarget, readingTarget, spelling);
		const [lemmaLink, readingLink, spellingLink] = targets.map(
			(target) =>
				renderReadingNote(verbData, aufstehen, {
					resolve: resolve(target),
				})
					.split("\n")
					.find((line) => line.includes("|"))
					?.match(/\[\[([^|\]]*)\|/u)?.[1],
		);
		expect(lemmaLink).toBe("Worter/de/Lexeme/NOUN/Fem/m/mut/mutte/Mutter");
		expect(readingLink).toBe(
			"Worter/de/Lexeme/NOUN/Fem/m/mut/mutte/👩 Mutter",
		);
		expect(spellingLink).toBe("Worter/m/mut/mutte/mutter");
	});

	it("shows the resolver every subject with its role and what the data names", () => {
		const roles = new Set<string>();
		renderReadingNote(nounData, parent, {
			inverseRelations: () => [
				{
					provenance: "inferred",
					relation: "hyponym",
					source: parent as never,
					target: readingsOf(verbData)[0] as never,
				},
			],
			resolve: (subject) => {
				roles.add(`${subject.role}:${subject.names.kind}`);
				return { key: "x", kind: "Spelling", language: "de" };
			},
		});
		expect([...roles].sort()).toEqual([
			"header:Lemma",
			"inverseRelation:Shadow",
			"pendingRelation:Shadow",
			"relation:Lemma",
		]);
	});

	it("takes other paths, such as a store's interim layout", () => {
		const body = renderReadingNote(nounData, parent, {
			paths: { lemma: (lemma) => `Other/${lemma.canonicalForm}` },
		});
		expect(body).toContain("[[Other/Mutter|Mutter]]");
	});
});

describe("pending relations", () => {
	it("refuses a Reading the records do not hold", () => {
		const stranger = {
			emojiDescription: "🦖",
			lemma: mutter,
			unitKind: "Reading",
		} as Dumling.Reading<"de">;
		expect(() => serializeReadingNote(nounData, stranger)).toThrow(
			"The Reading is not one of its Lemma's",
		);
	});

	it("writes only the source Reading's pending relations into its note", () => {
		const [parent, nut] = readingsOf(nounData);
		if (!parent || !nut) throw new Error("fixture");
		const records: LemmaRecords<"de"> = {
			...nounData,
			pendingRelations: [
				...nounData.pendingRelations,
				createPendingSemanticRelationRecord(nut, {
					relation: "hypernym",
					target: {
						canonicalForm: "Schraubteil",
						family: "Lexeme",
						kind: "NOUN",
						language: "de",
					},
				}),
			],
		};
		const nutNote = serializeReadingNote(records, nut);
		expect(valid(parseReading(nutNote).data).pendingRelations).toHaveLength(
			1,
		);
		expect(nutNote.body).toContain("Schraubteil");
		expect(serializeReadingNote(records, parent).body).not.toContain(
			"Schraubteil",
		);
	});
});
