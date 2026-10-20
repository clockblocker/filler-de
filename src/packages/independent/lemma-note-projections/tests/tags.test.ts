import { describe, expect, it } from "bun:test";
import type * as Dumling from "dumling/types";
import { deriveTags } from "../src";
import { input, lexeme, noun, verb } from "./fixtures";

describe("Tags from Core and Knowledge", () => {
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
			deriveTags(input(noun("Leute", null), { plural: "PluralOnly" })),
		).toEqual(["noun/plural-only"]);
		expect(
			deriveTags(input(noun("Schnee", "Masc"), { plural: "NoPlural" })),
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
					conjugationClass: ["Weak"],
				}),
			),
		).toEqual(["verb/separable", "verb/weak"]);
	});

	it("a reflexive verb", () => {
		expect(
			deriveTags(
				input(verb("sich hüten", { lexicallyReflexive: "Acc" })),
			),
		).toEqual(["verb/reflexive-acc"]);
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
