import { describe, expect, it } from "bun:test";
import { err, ok } from "neverthrow";
import {
	createLexicalGenerationModule,
	LexicalGenerationFailureKind,
	lexicalGenerationError,
	type StructuredFetchFn,
} from "../../src/index";
import {
	makeLexemeMeta,
	makeLexemeSelection,
} from "./helpers";

describe("lexical-generation lemma/disambiguation", () => {
	it("retries lemma generation and keeps the better guarded result", async () => {
		const calls: string[] = [];
		const module = createLexicalGenerationModule({
			fetchStructured: (async ({ requestLabel }) => {
				calls.push(requestLabel);
				if (requestLabel !== "Lemma") {
					throw new Error(`unexpected requestLabel ${requestLabel}`);
				}

				if (calls.length === 1) {
					return ok({
						contextWithLinkedParts: "Er geht auf.",
						lemma: "geht",
						linguisticUnit: "Lexem",
						posLikeKind: "Verb",
						surfaceKind: "Inflected",
					});
				}

				return ok({
					contextWithLinkedParts: "Er geht auf.",
					lemma: "aufgehen",
					linguisticUnit: "Lexem",
					posLikeKind: "Verb",
					surfaceKind: "Lemma",
				});
			}) as StructuredFetchFn,
			knownLang: "English",
			settings: { generateInflections: true },
			targetLang: "German",
		})._unsafeUnwrap();

		const result = await module.resolveSelection("geht", "Er geht auf.");

		expect(result.isOk()).toBe(true);
		expect(result._unsafeUnwrap()).toMatchObject({
			surface: {
				lemma: { pos: "VERB", spelledLemma: "aufgehen" },
				surfaceKind: "Lemma",
			},
		});
		expect(calls).toEqual(["Lemma", "Lemma"]);
	});

	it("maps disambiguation match and new-sense outcomes", async () => {
		const module = createLexicalGenerationModule({
			fetchStructured: (async ({ requestLabel }) => {
				if (requestLabel !== "Disambiguate") {
					return ok({});
				}

				return ok({
					emojiDescription: null,
					matchedIndex: 2,
				});
			}) as StructuredFetchFn,
			knownLang: "English",
			settings: { generateInflections: true },
			targetLang: "German",
		})._unsafeUnwrap();

		const matched = await module.disambiguateSense(
			makeLexemeSelection({ lemma: "Bank", pos: "NOUN" }),
			"Ich gehe zur Bank",
			[
				makeLexemeMeta({
					emojiDescription: ["🪑"],
					lemma: "Bank",
					pos: "NOUN",
				}),
				makeLexemeMeta({
					emojiDescription: ["🏦"],
					lemma: "Bank",
					pos: "NOUN",
				}),
			],
		);

		expect(matched.isOk()).toBe(true);
		expect(matched._unsafeUnwrap()).toEqual({
			cacheIndex: 1,
			kind: "matched",
		});

		const moduleForNewSense = createLexicalGenerationModule({
			fetchStructured: (async ({ requestLabel }) => {
				if (requestLabel !== "Disambiguate") {
					return ok({});
				}

				return ok({
					emojiDescription: ["🔒"],
					matchedIndex: null,
				});
			}) as StructuredFetchFn,
			knownLang: "English",
			settings: { generateInflections: true },
			targetLang: "German",
		})._unsafeUnwrap();

		const fresh = await moduleForNewSense.disambiguateSense(
			makeLexemeSelection({ lemma: "Schloss", pos: "NOUN" }),
			"Das Schloss an der Tur war kaputt.",
			[
				makeLexemeMeta({
					emojiDescription: ["🏰"],
					lemma: "Schloss",
					pos: "NOUN",
				}),
			],
		);

		expect(fresh.isOk()).toBe(true);
		expect(fresh._unsafeUnwrap()).toEqual({
			kind: "new",
			precomputedEmojiDescription: ["🔒"],
		});
	});

	it("returns prompt failures as Err for disambiguation", async () => {
		const module = createLexicalGenerationModule({
			fetchStructured: (async ({ requestLabel }) => {
				if (requestLabel === "Disambiguate") {
					return err(
						lexicalGenerationError(
							LexicalGenerationFailureKind.FetchFailed,
							"prompt failed",
						),
					);
				}
				return ok({});
			}) as StructuredFetchFn,
			knownLang: "English",
			settings: { generateInflections: true },
			targetLang: "German",
		})._unsafeUnwrap();

		const result = await module.disambiguateSense(
			makeLexemeSelection({ lemma: "Bank", pos: "NOUN" }),
			"Ich gehe zur Bank",
			[
				makeLexemeMeta({
					emojiDescription: ["🏦"],
					lemma: "Bank",
					pos: "NOUN",
				}),
			],
		);

		expect(result.isErr()).toBe(true);
	});
});
