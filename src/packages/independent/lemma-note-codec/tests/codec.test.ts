import { describe, expect, it } from "bun:test";
import type { LinkTarget } from "dumdict";
import { createPendingSemanticRelationRecord } from "dumdict/pending";
import type * as Dumling from "dumling/types";
import { Result } from "effect";
import {
	LemmaNoteMetadataSchema,
	type LemmaRecords,
	NoteSerializeError,
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
			const note = Result.getOrThrow(serializeLemmaNote(records));
			const parsed = parseLemma(note);
			expect(valid(parsed.data)).toEqual(lemmaNoteDataOf(records));
			expect(freeformTexts(parsed)).toEqual([]);
			// parse → serialize gives the same bytes and metadata.
			expect(
				Result.getOrThrow(
					serializeLemmaNote(records, { previous: parsed.document }),
				),
			).toEqual(note);
		});

		it(`${family}: each Reading note parses back to its records`, () => {
			for (const reading of readingsOf(records)) {
				const note = Result.getOrThrow(
					serializeReadingNote(records, reading),
				);
				const parsed = parseReading(note);
				expect(valid(parsed.data)).toEqual(
					readingNoteDataOf(records, reading),
				);
				expect(freeformTexts(parsed)).toEqual([]);
				expect(
					Result.getOrThrow(
						serializeReadingNote(records, reading, {
							previous: parsed.document,
						}),
					),
				).toEqual(note);
			}
		});

		it(`${family}: rendering twice gives identical bytes, and no marker`, () => {
			expect(Result.getOrThrow(renderLemmaNote(records))).toBe(
				Result.getOrThrow(renderLemmaNote(records)),
			);
			expect(Result.getOrThrow(renderLemmaNote(records))).not.toContain(
				"%%tf",
			);
			for (const reading of readingsOf(records)) {
				expect(
					Result.getOrThrow(renderReadingNote(records, reading)),
				).toBe(Result.getOrThrow(renderReadingNote(records, reading)));
				expect(
					Result.getOrThrow(renderReadingNote(records, reading)),
				).not.toContain("%%tf");
			}
		});

		it(`${family}: the metadata is JSON data its schema accepts`, () => {
			const lemma = Result.getOrThrow(
				serializeLemmaNote(records),
			).metadata;
			expect(JSON.parse(JSON.stringify(lemma))).toEqual(lemma);
			expect(LemmaNoteMetadataSchema.safeParse(lemma).success).toBe(true);
			for (const reading of readingsOf(records)) {
				const metadata = Result.getOrThrow(
					serializeReadingNote(records, reading),
				).metadata;
				expect(JSON.parse(JSON.stringify(metadata))).toEqual(metadata);
				expect(
					ReadingNoteMetadataSchema.safeParse(metadata).success,
				).toBe(true);
			}
		});
	}

	it("keeps nested Dumling and dumrel values exactly: a Valency Frame, both target modes", () => {
		const [entry] = verbData.readingEntries;
		if (!entry) throw new Error("fixture");
		const parsed = parseReading(
			Result.getOrThrow(serializeReadingNote(verbData, entry.reading)),
		);
		expect(valid(parsed.data).readingEntry.knowledge).toEqual(
			readingNoteDataOf(verbData, entry.reading).readingEntry.knowledge,
		);
		expect(
			JSON.stringify(valid(parsed.data).readingEntry.knowledge),
		).toContain('"kind":"Preposition"');
		const ihm = familyFixtures.syncretism;
		const [ihmEntry] = ihm.readingEntries;
		if (!ihmEntry) throw new Error("fixture");
		const relations = valid(
			parseReading(
				Result.getOrThrow(serializeReadingNote(ihm, ihmEntry.reading)),
			).data,
		).readingEntry.knowledge?.semanticRelations;
		// As dumdict normalizes it: the target's `♂️` loses its variation
		// selector.
		expect(relations).toEqual(
			readingNoteDataOf(ihm, ihmEntry.reading).readingEntry.knowledge
				?.semanticRelations,
		);
		expect(
			relations?.targetKind === "reading"
				? relations.synonym?.map((target) =>
						"emojiDescription" in target
							? target.emojiDescription
							: undefined,
					)
				: undefined,
		).toEqual(["♂"]);
	});

	it("keeps Mutter's pending relations, Attestation Links and owned Surface", () => {
		const [parent, nut] = readingsOf(nounData);
		if (!parent || !nut) throw new Error("fixture");
		const parentData = valid(
			parseReading(
				Result.getOrThrow(serializeReadingNote(nounData, parent)),
			).data,
		);
		expect(parentData.pendingRelations).toHaveLength(2);
		expect(parentData.readingEntry.attestationLinks).toEqual(
			nounData.readingEntries[0]?.attestationLinks ?? [],
		);
		expect(
			valid(
				parseReading(
					Result.getOrThrow(serializeReadingNote(nounData, nut)),
				).data,
			).pendingRelations,
		).toEqual([]);
		expect(
			valid(
				parseLemma(Result.getOrThrow(serializeLemmaNote(nounData)))
					.data,
			).ownedSurfaceEntries,
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
		const note = Result.getOrThrow(serializeReadingNote(records, parent));
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
		const note = Result.getOrThrow(serializeReadingNote(nounData, parent));
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
		const body = Result.getOrThrow(renderReadingNote(nounData, parent));
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
		expect(
			Result.getOrThrow(renderLemmaNote(nounData)).split("\n")[0],
		).toBe("die [[Worter/m/mut/mutte/mutter|Mutter]]");
		// A Lemma note links each of its own Reading notes.
		expect(Result.getOrThrow(renderLemmaNote(nounData))).toContain(
			"[[Worter/de/Lexeme/NOUN/Fem/m/mut/mutte/👩 Mutter|👩]]",
		);
	});

	it("by default: a preposition at its Crossroad", () => {
		const body = Result.getOrThrow(renderReadingNote(verbData, aufstehen));
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
				Result.getOrThrow(
					renderReadingNote(verbData, aufstehen, {
						resolve: resolve(target),
					}),
				)
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
		Result.getOrThrow(
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
			}),
		);
		expect([...roles].sort()).toEqual([
			"header:Lemma",
			"inverseRelation:Shadow",
			"pendingRelation:Shadow",
			"relation:Lemma",
		]);
	});

	it("takes other paths, such as a store's interim layout", () => {
		const body = Result.getOrThrow(
			renderReadingNote(nounData, parent, {
				paths: { lemma: (lemma) => `Other/${lemma.canonicalForm}` },
			}),
		);
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
		const refused = serializeReadingNote(nounData, stranger);
		if (Result.isSuccess(refused)) throw new Error("expected a failure");
		expect(refused.failure).toBeInstanceOf(NoteSerializeError);
		expect(refused.failure._tag).toBe("NoteSerializeError");
		expect(refused.failure.message).toBe(
			"The Reading is not one of its Lemma's",
		);
	});

	it("refuses records no valid note holds, with the rule they break", () => {
		const [first] = nounData.readingEntries;
		if (!first) throw new Error("expected a Reading Entry");
		const twice = {
			...nounData,
			readingEntries: [...nounData.readingEntries, first],
		};
		const refusals: Result.Result<NoteSerializeError, unknown>[] = [
			Result.flip(serializeLemmaNote(twice)),
			Result.flip(serializeReadingNote(twice, first.reading)),
		];
		for (const failure of refusals) {
			const error = Result.getOrThrow(failure);
			expect(error).toBeInstanceOf(NoteSerializeError);
			expect(error.message).toBe("Two Reading Entries hold one Reading");
		}
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
		const nutNote = Result.getOrThrow(serializeReadingNote(records, nut));
		expect(valid(parseReading(nutNote).data).pendingRelations).toHaveLength(
			1,
		);
		expect(nutNote.body).toContain("Schraubteil");
		expect(
			Result.getOrThrow(serializeReadingNote(records, parent)).body,
		).not.toContain("Schraubteil");
	});
});

describe("a lexical reflexive in the Valency Frame (texteater ADR 0052)", () => {
	const lemmaOf = (
		canonicalForm: string,
		hasSepPrefix: string | null = null,
	): Dumling.Lemma<"de", "Lexeme", "VERB"> => ({
		canonicalForm,
		coreFeatures: { hasSepPrefix },
		family: "Lexeme",
		kind: "VERB",
		language: "de",
		unitKind: "Lemma",
	});
	const adp = (canonicalForm: string): Dumling.Lemma<"de"> => ({
		canonicalForm,
		coreFeatures: {},
		family: "Lexeme",
		kind: "ADP",
		language: "de",
		unitKind: "Lemma",
	});
	const valencyOf = (
		lemma: Dumling.Lemma<"de">,
		valency: NonNullable<
			LemmaRecords<"de">["readingEntries"][number]["knowledge"]
		>["valency"],
	) => {
		const reading = {
			emojiDescription: "🪞🧠",
			lemma,
			unitKind: "Reading",
		} as Dumling.Reading<"de">;
		const records: LemmaRecords<"de"> = {
			lemmaRecord: { lemma },
			ownedSurfaceEntries: [],
			pendingRelations: [],
			readingEntries: [
				{
					attestationLinks: [],
					attestedTranslations: [],
					knowledge: { valency },
					notes: "",
					reading,
				},
			],
		};
		const body = Result.getOrThrow(renderReadingNote(records, reading));
		return body.split("\n").filter((line) => /^\d+\. /u.test(line));
	};

	it("shows sich, naming its case only when Dat, with an Optional Slot's status", () => {
		expect(
			valencyOf(lemmaOf("erinnern"), [
				{
					complements: [{ governedCase: "Acc", kind: "Reflexive" }],
					status: "Required",
				},
				{
					complements: [
						{
							governedCase: "Acc",
							kind: "Preposition",
							preposition: adp("an") as never,
							referent: "Either",
						},
					],
					status: "Required",
				},
			]),
		).toEqual([
			"1. Required: sich",
			"2. Required: [[Worter/a/an/an/an|an]] + Acc",
		]);
		expect(
			valencyOf(lemmaOf("vorstellen", "vor"), [
				{
					complements: [{ governedCase: "Dat", kind: "Reflexive" }],
					status: "Optional",
				},
			]),
		).toEqual(["1. Optional: sich (Dat)"]);
	});

	it("puts a fixed phrase's reflexive after the preposition it follows", () => {
		expect(
			valencyOf(lemmaOf("sein"), [
				{
					complements: [
						{
							governedCase: "Dat",
							kind: "Reflexive",
							preposition: adp("außer") as never,
						},
					],
					status: "Required",
				},
			]),
		).toEqual([
			"1. Required: [[Worter/a/auß/außer/außer|außer]] sich (Dat)",
		]);
	});
});

describe("a Reading's Breakdown and Source (texteater ADR 0050)", () => {
	const noun = (canonicalForm: string): Dumling.Lemma<"de"> => ({
		canonicalForm,
		coreFeatures: { gender: "Neut" },
		family: "Lexeme",
		kind: "NOUN",
		language: "de",
		unitKind: "Lemma",
	});
	const shadow = (family: string, kind: string, canonicalForm: string) =>
		({ canonicalForm, family, kind, language: "de" }) as never;
	const roundTrip = (
		lemma: Dumling.Lemma<"de">,
		knowledge: NonNullable<
			LemmaRecords<"de">["readingEntries"][number]["knowledge"]
		>,
	) => {
		const reading = {
			emojiDescription: "🏭",
			lemma,
			unitKind: "Reading",
		} as Dumling.Reading<"de">;
		const records: LemmaRecords<"de"> = {
			lemmaRecord: { lemma },
			ownedSurfaceEntries: [],
			pendingRelations: [],
			readingEntries: [
				{
					attestationLinks: [],
					attestedTranslations: [],
					knowledge,
					notes: "",
					reading,
				},
			],
		};
		return valid(
			parseReading(
				Result.getOrThrow(serializeReadingNote(records, reading)),
			).data,
		).readingEntry.knowledge;
	};

	it("keeps both halves, each piece's Lemma or Unit Shadow target, and filler", () => {
		const breakdown = {
			constituents: [
				{ letters: "Kohle", target: noun("Kohle") },
				{
					letters: "kraftwerk",
					target: shadow("Lexeme", "NOUN", "Kraftwerk"),
				},
			],
			morphemes: [
				{ letters: "Kohl", target: shadow("Morpheme", "Root", "kohl") },
				{ letters: "e" },
				{
					letters: "kraft",
					target: shadow("Morpheme", "Root", "kraft"),
				},
				{ letters: "werk", target: shadow("Morpheme", "Root", "werk") },
			],
		};
		expect(roundTrip(noun("Kohlekraftwerk"), { breakdown })).toEqual({
			breakdown,
		});
	});

	it("keeps a Source to a Lemma or a Unit Shadow", () => {
		const laufen: Dumling.Lemma<"de"> = {
			canonicalForm: "laufen",
			coreFeatures: { hasSepPrefix: null },
			family: "Lexeme",
			kind: "VERB",
			language: "de",
			unitKind: "Lemma",
		};
		for (const target of [laufen, shadow("Lexeme", "VERB", "laufen")])
			expect(roundTrip(noun("Laufen"), { source: { target } })).toEqual({
				source: { target },
			});
	});
});
