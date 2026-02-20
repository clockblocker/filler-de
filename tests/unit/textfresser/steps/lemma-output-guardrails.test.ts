import { describe, expect, it } from "bun:test";
import {
	chooseBestEffortLemmaOutput,
	evaluateLemmaOutputGuardrails,
} from "../../../../src/commanders/textfresser/orchestration/lemma/lemma-output-guardrails";

describe("lemma output guardrails", () => {
	it("flags same-surface inflected separable verb outputs", () => {
		const evaluation = evaluateLemmaOutputGuardrails({
			context: "Du [fängst] morgen mit der Arbeit an.",
			output: {
				contextWithLinkedParts: undefined,
				lemma: "fängst",
				linguisticUnit: "Lexem",
				posLikeKind: "Verb",
				surfaceKind: "Inflected",
			},
			surface: "fängst",
		});

		expect(evaluation.coreIssues.length).toBeGreaterThan(0);
	});

	it("flags same-surface comparative adjective outputs", () => {
		const evaluation = evaluateLemmaOutputGuardrails({
			context: "Sie ist [klüger] als ihr Bruder.",
			output: {
				contextWithLinkedParts: undefined,
				lemma: "klüger",
				linguisticUnit: "Lexem",
				posLikeKind: "Adjective",
				surfaceKind: "Inflected",
			},
			surface: "klüger",
		});

		expect(evaluation.coreIssues.length).toBeGreaterThan(0);
	});

	it("drops contextWithLinkedParts when stripped text mismatches input context", () => {
		const evaluation = evaluateLemmaOutputGuardrails({
			context: "Du [fängst] morgen mit der Arbeit an.",
			output: {
				contextWithLinkedParts: "Du [fängst] morgen [an] EXTRA",
				lemma: "anfangen",
				linguisticUnit: "Lexem",
				posLikeKind: "Verb",
				surfaceKind: "Inflected",
			},
			surface: "fängst",
		});

		expect(evaluation.droppedContextWithLinkedParts).toBe(true);
		expect(evaluation.output.contextWithLinkedParts).toBeUndefined();
	});

	it("prefers retry output when it has fewer core issues", () => {
		const first = evaluateLemmaOutputGuardrails({
			context: "Du [fängst] morgen mit der Arbeit an.",
			output: {
				contextWithLinkedParts: undefined,
				lemma: "fängst",
				linguisticUnit: "Lexem",
				posLikeKind: "Verb",
				surfaceKind: "Inflected",
			},
			surface: "fängst",
		});
		const second = evaluateLemmaOutputGuardrails({
			context: "Du [fängst] morgen mit der Arbeit an.",
			output: {
				contextWithLinkedParts: undefined,
				lemma: "anfangen",
				linguisticUnit: "Lexem",
				posLikeKind: "Verb",
				surfaceKind: "Inflected",
			},
			surface: "fängst",
		});

		const chosen = chooseBestEffortLemmaOutput({ first, second });
		expect(chosen.output.lemma).toBe("anfangen");
	});

	it("normalizes path-like lemma outputs to basename", () => {
		const evaluation = evaluateLemmaOutputGuardrails({
			context: "Er [fährt] schnell.",
			output: {
				contextWithLinkedParts: "Er [[Worter/de/lexem/lemma/f/fah/fahre/Fahren|fährt]] schnell.",
				lemma: "Worter/de/lexem/lemma/f/fah/fahre/Fahren",
				linguisticUnit: "Lexem",
				posLikeKind: "Verb",
				surfaceKind: "Inflected",
			},
			surface: "fährt",
		});

		expect(evaluation.output.lemma).toBe("Fahren");
	});

	it("keeps normalized contextWithLinkedParts when stripped text matches", () => {
		const evaluation = evaluateLemmaOutputGuardrails({
			context: "Er [[Fahren|fährt]] schnell.",
			output: {
				contextWithLinkedParts:
					"Er [[Worter/de/lexem/lemma/f/fah/fahre/Fahren|fährt]] schnell.",
				lemma: "fahren",
				linguisticUnit: "Lexem",
				posLikeKind: "Verb",
				surfaceKind: "Inflected",
			},
			surface: "fährt",
		});

		expect(evaluation.droppedContextWithLinkedParts).toBe(false);
		expect(evaluation.output.contextWithLinkedParts).toBe(
			"Er [[Fahren|fährt]] schnell.",
		);
	});
});
