import { describe, expect, test } from "bun:test";
import { MORPHEMES_LINE_CLASS } from "@textfresser/lemma-note-codec";
import type { PlannedChangeOp } from "dumdict";
import type * as Dumling from "dumling/types";
import type * as Dumrel from "dumrel/types";
import { noteMetadataHelper } from "../src/internal/note-metadata";
import { expectIndexMatchesFiles } from "./support/files";
import { createLemma, createReading, readingEntry } from "./support/fixtures";
import { lemmaPath, readingPath } from "./support/paths";
import { openStore, seed } from "./support/store";

const noun = (
	canonicalForm: string,
	gender: "Fem" | "Masc" | "Neut",
): Dumling.Lemma<"de"> =>
	({
		canonicalForm,
		coreFeatures: { gender },
		family: "Lexeme",
		kind: "NOUN",
		language: "de",
		unitKind: "Lemma",
	}) as Dumling.Lemma<"de">;

const readingOf = (lemma: Dumling.Lemma<"de">, emojiDescription: string) =>
	({
		emojiDescription,
		lemma,
		unitKind: "Reading",
	}) as Dumling.Reading<"de">;

const kohle = noun("Kohle", "Fem");
const kraft = noun("Kraft", "Fem");
const werk = noun("Werk", "Neut");
const kraftwerk = noun("Kraftwerk", "Neut");
const kohlekraftwerk = noun("Kohlekraftwerk", "Neut");
const betreiber = noun("Kohlekraftwerksbetreiber", "Masc");

const kraftwerkReading = readingOf(kraftwerk, "⚡");
const kohlekraftwerkReading = readingOf(kohlekraftwerk, "🏭");
const betreiberReading = readingOf(betreiber, "🧑‍💼");

const link = (lemma: Dumling.Lemma<"de">, alias: string) =>
	`[[${lemmaPath(lemma).replace(/\.md$/u, "")}|${alias}]]`;

/** A Breakdown's pieces, as dumrel stores them. */
type Pieces = NonNullable<
	NonNullable<Dumrel.MorphemeSources["breakdown"]>["constituents"]
>;

const constituents = (
	reading: Dumling.Reading<"de">,
	value: { letters: string; target?: Dumling.Lemma<"de"> }[],
): PlannedChangeOp<"de"> => ({
	ops: [
		{
			envelope: {
				change: {
					aspect: "breakdown",
					kind: "Contribute",
					part: "constituents",
					value: value as Pieces,
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

/** The note's morphemes line, if it has one. */
const morphemesLine = (content: string | undefined) =>
	noteMetadataHelper
		.body(content ?? "")
		.split("\n")
		.find((line) => line.includes(MORPHEMES_LINE_CLASS))
		?.replace(`<span class="${MORPHEMES_LINE_CLASS}"></span>`, "");

describe("Breakdowns in Reading notes", () => {
	test("a part's Breakdown arriving re-renders every morphemes line that walks it, in the same commit", async () => {
		const { store, vault } = await openStore();
		await seed(store, [
			...[kohle, kraft, werk, kraftwerk, kohlekraftwerk, betreiber].map(
				createLemma,
			),
			createReading(readingEntry(kraftwerkReading)),
			createReading(
				readingEntry(kohlekraftwerkReading, {
					knowledge: {
						breakdown: {
							constituents: [
								{ letters: "Kohle", target: kohle },
								{ letters: "kraftwerk", target: kraftwerk },
							],
						},
					},
				}),
			),
			createReading(
				readingEntry(betreiberReading, {
					knowledge: {
						breakdown: {
							constituents: [
								{
									letters: "Kohlekraftwerk",
									target: kohlekraftwerk,
								},
								{ letters: "s" },
								{
									letters: "betreiber",
									target: noun("Betreiber", "Masc"),
								},
							],
						},
					},
				}),
			),
		]);
		const ownerNote = readingPath(kohlekraftwerkReading);
		const betreiberNote = readingPath(betreiberReading);
		expect(morphemesLine(vault.content(ownerNote))).toBe(
			`${link(kohle, "Kohle")}|${link(kraftwerk, "kraftwerk")}`,
		);

		await seed(store, [
			constituents(kraftwerkReading, [
				{ letters: "Kraft", target: kraft },
				{ letters: "werk", target: werk },
			]),
		]);

		expect(morphemesLine(vault.content(ownerNote))).toBe(
			`${link(kohle, "Kohle")}|${link(kraft, "kraft")}|${link(werk, "werk")}`,
		);
		// Two parts up: the walk reads Kohlekraftwerk, which reads Kraftwerk.
		expect(morphemesLine(vault.content(betreiberNote))).toStartWith(
			`${link(kohle, "Kohle")}|${link(kraft, "kraft")}|${link(werk, "werk")}|s|`,
		);
		await expectIndexMatchesFiles(store, vault);
	});

	const werkShadow = {
		canonicalForm: "Werk",
		family: "Lexeme",
		kind: "NOUN",
		language: "de",
	} as const;
	const crossroadWerk = "[[Worter/w/wer/werk/werk|werk]]";

	/** Kraftwerk = Kraft + werk, `werk` a Shadow; Kohlekraftwerk walks Kraftwerk. */
	async function shadowChain() {
		const opened = await openStore();
		await seed(opened.store, [
			...[kohle, kraft, kraftwerk, kohlekraftwerk].map(createLemma),
			createReading(
				readingEntry(kraftwerkReading, {
					knowledge: {
						breakdown: {
							constituents: [
								{ letters: "Kraft", target: kraft },
								{ letters: "werk", target: werkShadow },
							],
						},
					},
				}),
			),
			createReading(
				readingEntry(kohlekraftwerkReading, {
					knowledge: {
						breakdown: {
							constituents: [
								{ letters: "Kohle", target: kohle },
								{ letters: "kraftwerk", target: kraftwerk },
							],
						},
					},
				}),
			),
		]);
		return opened;
	}

	const deleteLemma = (
		lemma: Dumling.Lemma<"de">,
	): PlannedChangeOp<"de"> => ({
		lemma,
		preconditions: [{ kind: "lemmaExists", lemma }],
		type: "deleteLemma",
	});

	test("storing and removing an inherited part's Lemma moves its link in every line that walks it", async () => {
		const { store, vault } = await shadowChain();
		const ownerNote = readingPath(kohlekraftwerkReading);
		const crossroadLine = `${link(kohle, "Kohle")}|${link(kraft, "kraft")}|${crossroadWerk}`;
		const lemmaLine = `${link(kohle, "Kohle")}|${link(kraft, "kraft")}|${link(werk, "werk")}`;
		expect(morphemesLine(vault.content(ownerNote))).toBe(crossroadLine);

		await seed(store, [createLemma(werk)]);
		expect(morphemesLine(vault.content(ownerNote))).toBe(lemmaLine);

		await seed(store, [deleteLemma(werk)]);
		expect(morphemesLine(vault.content(ownerNote))).toBe(crossroadLine);
		await expectIndexMatchesFiles(store, vault);
	});

	test("a second Lemma of the part's Shadow joining or leaving moves the inherited link too", async () => {
		const { store, vault } = await shadowChain();
		const ownerNote = readingPath(kohlekraftwerkReading);
		const otherWerk = noun("Werk", "Masc");
		await seed(store, [createLemma(werk)]);
		expect(morphemesLine(vault.content(ownerNote))).toEndWith(
			link(werk, "werk"),
		);

		// Two Lemmas match the Shadow: the link goes to the Crossroad note.
		await seed(store, [createLemma(otherWerk)]);
		expect(morphemesLine(vault.content(ownerNote))).toEndWith(
			crossroadWerk,
		);

		await seed(store, [deleteLemma(otherWerk)]);
		expect(morphemesLine(vault.content(ownerNote))).toEndWith(
			link(werk, "werk"),
		);
		await expectIndexMatchesFiles(store, vault);
	});

	test("a part read by more than 200 lines re-renders 200 in its commit and the rest after it", async () => {
		const { store, vault } = await openStore();
		const owners = Array.from({ length: 205 }, (_, at) =>
			noun(`Werk${String(at).padStart(3, "0")}bau`, "Masc"),
		);
		const readings = owners.map((owner) => readingOf(owner, "🏗"));
		await seed(store, [
			createLemma(werk),
			createReading(readingEntry(readingOf(werk, "🏭"))),
			...owners.map(createLemma),
			...readings.map((reading) =>
				createReading(
					readingEntry(reading, {
						knowledge: {
							breakdown: {
								constituents: [
									{ letters: "Werk", target: werk },
									{
										letters:
											reading.lemma.canonicalForm.slice(
												4,
											),
									},
								],
							},
						},
					}),
				),
			),
		]);
		const paths = new Set(readings.map(readingPath));
		vault.batches.length = 0;

		await seed(store, [
			{
				ops: [
					{
						envelope: {
							change: {
								aspect: "breakdown",
								kind: "Contribute",
								part: "morphemes",
								value: [
									{
										letters: "werk",
										target: {
											canonicalForm: "werk",
											family: "Morpheme",
											kind: "Root",
											language: "de",
										},
									},
								] as Pieces,
							},
							reading: readingOf(werk, "🏭"),
						},
						kind: "applyKnowledgeChange",
					},
				],
				preconditions: [],
				reading: readingOf(werk, "🏭"),
				type: "patchReading",
			},
		]);

		for (const path of paths)
			expect(morphemesLine(vault.content(path))).toStartWith(
				"[[Worter/w/wer/werk/werk|Werk]]",
			);
		const perBatch = vault.batches.map(
			(batch) =>
				batch.filter(({ payload }) => {
					const { splitPath } = payload as {
						splitPath: { pathParts: string[]; basename: string };
					};
					return paths.has(
						`${[...splitPath.pathParts, splitPath.basename].join("/")}.md`,
					);
				}).length,
		);
		expect(Math.max(...perBatch)).toBeLessThanOrEqual(200);
		expect(perBatch.reduce((sum, count) => sum + count, 0)).toBe(205);
	});
});
