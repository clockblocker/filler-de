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
});
