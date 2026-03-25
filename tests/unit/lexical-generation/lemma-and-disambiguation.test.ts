import { describe, expect, it } from "bun:test";
import { err, ok } from "neverthrow";
import {
	createLexicalGenerationModule,
	lexicalGenerationError,
	LexicalGenerationFailureKind,
} from "../../../src/lexical-generation";

describe("lexical-generation lemma/disambiguation", () => {
	it("retries lemma generation and keeps the better guarded result", async () => {
		const calls: string[] = [];
		const module = createLexicalGenerationModule({
			fetchStructured: async ({ requestLabel }) => {
				calls.push(requestLabel);
				if (requestLabel !== "Lemma") {
					throw new Error(`unexpected requestLabel ${requestLabel}`);
				}

				if (calls.length === 1) {
					return ok({
						lemma: "geht",
						linguisticUnit: "Lexem",
						posLikeKind: "Verb",
						surfaceKind: "Inflected",
					});
				}

				return ok({
					lemma: "aufgehen",
					linguisticUnit: "Lexem",
					posLikeKind: "Verb",
					surfaceKind: "Lemma",
				});
			},
			knownLang: "English",
			settings: { generateInflections: true },
			targetLang: "German",
		})._unsafeUnwrap();

		const result = await module
			.buildLemmaGenerator()("geht", "Er geht auf.");

		expect(result.isOk()).toBe(true);
		expect(result._unsafeUnwrap()).toMatchObject({
			lemma: "aufgehen",
			linguisticUnit: "Lexem",
			posLikeKind: "Verb",
			surfaceKind: "Lemma",
		});
		expect(calls).toEqual(["Lemma", "Lemma"]);
	});

	it("maps disambiguation match and new-sense outcomes", async () => {
		const module = createLexicalGenerationModule({
			fetchStructured: async ({ requestLabel }) => {
				if (requestLabel !== "Disambiguate") {
					return ok({});
				}

				return ok({
					emojiDescription: null,
					matchedIndex: 2,
				});
			},
			knownLang: "English",
			settings: { generateInflections: true },
			targetLang: "German",
		})._unsafeUnwrap();

		const matched = await module.buildSenseDisambiguator()(
			{
				lemma: "Bank",
				linguisticUnit: "Lexem",
				posLikeKind: "Noun",
				surfaceKind: "Lemma",
			},
			"Ich gehe zur Bank",
			[
				{
					emojiDescription: ["🪑"],
					id: "sense-1",
					linguisticUnit: "Lexem",
					posLikeKind: "Noun",
				},
				{
					emojiDescription: ["🏦"],
					id: "sense-2",
					linguisticUnit: "Lexem",
					posLikeKind: "Noun",
				},
			],
		);

		expect(matched.isOk()).toBe(true);
		expect(matched._unsafeUnwrap()).toEqual({
			kind: "matched",
			senseId: "sense-2",
		});

		const moduleForNewSense = createLexicalGenerationModule({
			fetchStructured: async ({ requestLabel }) => {
				if (requestLabel !== "Disambiguate") {
					return ok({});
				}

				return ok({
					emojiDescription: ["🔒"],
					matchedIndex: null,
				});
			},
			knownLang: "English",
			settings: { generateInflections: true },
			targetLang: "German",
		})._unsafeUnwrap();

		const fresh = await moduleForNewSense.buildSenseDisambiguator()(
			{
				lemma: "Schloss",
				linguisticUnit: "Lexem",
				posLikeKind: "Noun",
				surfaceKind: "Lemma",
			},
			"Das Schloss an der Tur war kaputt.",
			[
				{
					emojiDescription: ["🏰"],
					id: "sense-1",
					linguisticUnit: "Lexem",
					posLikeKind: "Noun",
				},
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
			fetchStructured: async ({ requestLabel }) => {
				if (requestLabel === "Disambiguate") {
					return err(
						lexicalGenerationError(
							LexicalGenerationFailureKind.FetchFailed,
							"prompt failed",
						),
					);
				}
				return ok({});
			},
			knownLang: "English",
			settings: { generateInflections: true },
			targetLang: "German",
		})._unsafeUnwrap();

		const result = await module.buildSenseDisambiguator()(
			{
				lemma: "Bank",
				linguisticUnit: "Lexem",
				posLikeKind: "Noun",
				surfaceKind: "Lemma",
			},
			"Ich gehe zur Bank",
			[
				{
					emojiDescription: ["🏦"],
					id: "sense-1",
					linguisticUnit: "Lexem",
					posLikeKind: "Noun",
				},
			],
		);

		expect(result.isErr()).toBe(true);
	});
});
