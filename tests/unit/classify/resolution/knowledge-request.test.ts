import { describe, expect, it } from "bun:test";
import type * as Dumling from "dumling/types";
import type * as Dumrel from "dumrel/types";
import { paradigmRequestFor } from "../../../../src/commanders/classify/resolution/knowledge-request";

const lemma = (kind: string, canonicalForm: string, coreFeatures: object) =>
	({
		canonicalForm,
		coreFeatures,
		family: "Lexeme",
		kind,
		language: "de",
		unitKind: "Lemma",
	}) as Dumling.Lemma<"de">;
const readingOf = (of: Dumling.Lemma<"de">, emojiDescription: string) =>
	({ emojiDescription, lemma: of, unitKind: "Reading" }) as Dumling.Reading<"de">;

const bank = lemma("NOUN", "Bank", { gender: "Fem" });
const bench = readingOf(bank, "🪑");
const money = readingOf(bank, "🏦");
const stored = { dimensions: {} } as Dumrel.LemmaParadigm;

describe("knowledge.produce's paradigm input (texteater#1230)", () => {
	it("asks a New Reading for its route's dimensions, with the stored Paradigm and the Lemma's Readings", () => {
		expect(paradigmRequestFor({ origin: "New", reading: money, readings: [bench], stored })).toEqual({
			dimensions: ["plural"],
			readings: [bench],
			stored,
		});
		const fahren = lemma("VERB", "fahren", { hasSepPrefix: null, lexicallyReflexive: null });
		expect(
			paradigmRequestFor({ origin: "New", reading: readingOf(fahren, "🚗"), readings: [] })?.dimensions,
		).toEqual(["preterite", "present1", "present2", "present3", "pastParticiple", "subjunctivePast"]);
	});

	it("asks nothing for a TopUp, or for a route without dimensions", () => {
		expect(paradigmRequestFor({ origin: "TopUp", reading: bench, readings: [bench] })).toBeUndefined();
		const schnell = lemma("ADJ", "schnell", { comparable: "Yes" });
		expect(paradigmRequestFor({ origin: "New", reading: readingOf(schnell, "⚡"), readings: [] })).toBeUndefined();
	});
});
