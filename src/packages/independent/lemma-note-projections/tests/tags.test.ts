import { describe, expect, it } from "bun:test";
import type * as Dumling from "dumling/types";
import { applyParadigmChanges, paradigmChangesFor } from "dumrel";
import type * as Dumrel from "dumrel/types";
import { deriveTags, readingTags, type TagInput } from "../src";

type De = "de";

function noun(
	canonicalForm: string,
	gender: Dumling.Lemma<De, "Lexeme", "NOUN">["coreFeatures"]["gender"],
): Dumling.Lemma<De, "Lexeme", "NOUN"> {
	return {
		canonicalForm,
		coreFeatures: { gender },
		family: "Lexeme",
		kind: "NOUN",
		language: "de",
		unitKind: "Lemma",
	};
}

function verb(
	canonicalForm: string,
	core: { readonly hasSepPrefix?: string } = {},
): Dumling.Lemma<De, "Lexeme", "VERB"> {
	return {
		canonicalForm,
		coreFeatures: {
			hasSepPrefix: core.hasSepPrefix ?? null,
		},
		family: "Lexeme",
		kind: "VERB",
		language: "de",
		unitKind: "Lemma",
	};
}

function lexeme<K extends "ADJ" | "ADV" | "PROPN">(
	kind: K,
	canonicalForm: string,
	coreFeatures: Dumling.Lemma<De, "Lexeme", K>["coreFeatures"],
): Dumling.Lemma<De, "Lexeme", K> {
	return {
		canonicalForm,
		coreFeatures,
		family: "Lexeme",
		kind,
		language: "de",
		unitKind: "Lemma",
	} as Dumling.Lemma<De, "Lexeme", K>;
}

const input = (
	lemma: Dumling.Lemma,
	rest: Omit<TagInput, "lemma"> = {},
): TagInput => ({ lemma, ...rest });

describe("Tags from Core and Licences", () => {
	it("a noun's gender", () => {
		expect(deriveTags(input(noun("Tag", "Masc")))).toEqual([
			"noun/masculine",
		]);
		expect(deriveTags(input(noun("Fahrkarte", "Fem")))).toEqual([
			"noun/feminine",
		]);
	});

	it("each gender of a mixed one", () => {
		expect(
			deriveTags(input(noun("Balg", { mixed: ["Masc", "Neut"] }))),
		).toEqual(["noun/masculine", "noun/neuter"]);
	});

	it("a noun's stored plural class", () => {
		expect(
			deriveTags(
				input(noun("Leute", null), { pluralMarker: "PluralOnly" }),
			),
		).toEqual(["noun/plural-only"]);
		expect(
			deriveTags(
				input(noun("Schnee", "Masc"), { pluralMarker: "NoPlural" }),
			),
		).toEqual(["noun/masculine", "noun/singular-only"]);
	});

	it("a proper noun's Kind, article and gender", () => {
		expect(
			deriveTags(
				input(
					lexeme("PROPN", "Schweiz", {
						article: "Definite",
						gender: "Fem",
					}),
				),
			),
		).toEqual(["proper-noun/with-article", "proper-noun/feminine"]);
		expect(
			deriveTags(
				input(
					lexeme("PROPN", "Berlin", { article: null, gender: null }),
				),
			),
		).toEqual(["proper-noun"]);
	});

	it("a separable verb and its conjugation class", () => {
		expect(
			deriveTags(
				input(verb("aufpassen", { hasSepPrefix: "auf" }), {
					conjugationClasses: ["Weak"],
				}),
			),
		).toEqual(["verb/separable", "verb/weak"]);
	});

	it("a reflexive Reading, by its reflexive's case", () => {
		expect(
			deriveTags(
				input(verb("hüten"), { reflexive: { governedCase: "Acc" } }),
			),
		).toEqual(["verb/reflexive-acc"]);
		expect(
			deriveTags(
				input(verb("vorstellen", { hasSepPrefix: "vor" }), {
					reflexive: { governedCase: "Dat" },
				}),
			),
		).toEqual(["verb/separable", "verb/reflexive-dat"]);
	});

	it("a plain verb gets its route alone", () => {
		expect(deriveTags(input(verb("fahren")))).toEqual(["verb"]);
	});

	it("a comparable adjective", () => {
		expect(
			deriveTags(input(lexeme("ADJ", "schnell", { comparable: "Yes" }))),
		).toEqual(["adjective/comparable"]);
	});

	it("a Locution is tagged under its Family", () => {
		const locution = {
			canonicalForm: "Vorsicht walten lassen",
			coreFeatures: {},
			family: "Locution",
			kind: "VERB",
			language: "de",
			unitKind: "Lemma",
		} as unknown as Dumling.Lemma;
		expect(deriveTags(input(locution))).toEqual(["locution/verb"]);
	});
});

const readingOf = (lemma: Dumling.Lemma<De>, emojiDescription: string) =>
	({ emojiDescription, lemma, unitKind: "Reading" }) as Dumling.Reading<De>;

function paradigmOf(
	lemma: Dumling.Lemma<De>,
	licences: readonly [Dumling.Reading<De>, Dumrel.DimensionId, string[]][],
): Dumrel.LemmaParadigm {
	const result = applyParadigmChanges({
		changes: licences.flatMap(([reading, dimension, values]) =>
			paradigmChangesFor({
				dimension,
				provenance: "Produced",
				reading,
				values,
			}),
		),
		lemma,
		paradigm: { dimensions: {} },
		readings: [...new Set(licences.map(([reading]) => reading))],
	});
	if (!result.success) throw result.error;
	return result.value;
}

const tagsOf = (
	lemma: Dumling.Lemma<De>,
	reading: Dumling.Reading<De>,
	paradigm?: Dumrel.LemmaParadigm,
	valency?: Dumrel.ValencyFrame,
) =>
	readingTags({
		entry: { reading, ...(valency ? { knowledge: { valency } } : {}) },
		records: { lemmaRecord: { lemma, ...(paradigm ? { paradigm } : {}) } },
	});

describe("the tags hook reads a Reading's own Licences in the Lemma Paradigm", () => {
	it("tags the conjugation class each licensed Präteritum gives", () => {
		const fahren = verb("fahren");
		const car = readingOf(fahren, "🚗");
		expect(
			tagsOf(
				fahren,
				car,
				paradigmOf(fahren, [[car, "preterite", ["fuhr"]]]),
			),
		).toEqual(["verb/strong"]);
		const kaufen = verb("kaufen");
		const buy = readingOf(kaufen, "🛒");
		expect(
			tagsOf(
				kaufen,
				buy,
				paradigmOf(kaufen, [[buy, "preterite", ["kaufte"]]]),
			),
		).toEqual(["verb/weak"]);
	});

	it("tags both classes of a Free dimension, melken's molk / melkte", () => {
		const melken = verb("melken");
		const cow = readingOf(melken, "🐄");
		expect(
			tagsOf(
				melken,
				cow,
				paradigmOf(melken, [[cow, "preterite", ["molk", "melkte"]]]),
			),
		).toEqual(["verb/weak", "verb/strong"]);
	});

	it("tags only what the Reading's own Licence takes", () => {
		const senden = verb("senden");
		const mail = readingOf(senden, "📨");
		const broadcast = readingOf(senden, "📡");
		const paradigm = paradigmOf(senden, [
			[mail, "preterite", ["sandte"]],
			[broadcast, "preterite", ["sendete"]],
		]);
		expect(tagsOf(senden, mail, paradigm)).toEqual(["verb/mixed"]);
		expect(tagsOf(senden, broadcast, paradigm)).toEqual(["verb/weak"]);
	});

	it("tags a licensed plural marker", () => {
		const geld = noun("Geld", "Neut");
		const money = readingOf(geld, "💶");
		expect(
			tagsOf(
				geld,
				money,
				paradigmOf(geld, [[money, "plural", ["NoPlural"]]]),
			),
		).toEqual(["noun/neuter", "noun/singular-only"]);
	});

	it("tags Core alone without a Paradigm", () => {
		const tag = noun("Tag", "Masc");
		expect(tagsOf(tag, readingOf(tag, "📅"))).toEqual(["noun/masculine"]);
	});
});

describe("the tags hook reads a Reading's reflexive from its Valency Frame", () => {
	const erinnern = verb("erinnern");

	it("tags a Required or Optional Reflexive Slot by its case", () => {
		expect(
			tagsOf(erinnern, readingOf(erinnern, "🪞🧠"), undefined, [
				{
					complements: [{ governedCase: "Acc", kind: "Reflexive" }],
					status: "Required",
				},
			]),
		).toEqual(["verb/reflexive-acc"]);
		const ausruhen = verb("ausruhen", { hasSepPrefix: "aus" });
		expect(
			tagsOf(ausruhen, readingOf(ausruhen, "😌"), undefined, [
				{
					complements: [{ governedCase: "Acc", kind: "Reflexive" }],
					status: "Optional",
				},
			]),
		).toEqual(["verb/separable", "verb/reflexive-acc"]);
	});

	it("gives a Reading with no Reflexive Slot no reflexive tag", () => {
		expect(
			tagsOf(erinnern, readingOf(erinnern, "💭"), undefined, [
				{
					complements: [
						{
							governedCase: "Acc",
							kind: "Case",
							referent: "Someone",
						},
					],
					status: "Required",
				},
			]),
		).toEqual(["verb"]);
	});
});
