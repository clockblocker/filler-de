import { describe, expect, it } from "bun:test";
import { err, ok } from "neverthrow";
import {
	createLexicalGenerationClient,
	createLexicalMeta,
	LexicalGenerationFailureKind,
	lexicalGenerationError,
	type StructuredFetchFn,
} from "../../src";
import { makeLexemeMeta, makeLexemeSelection } from "./helpers";

describe("lexical-generation-next selection/disambiguation", () => {
	it("retries selection resolution and keeps the better native output", async () => {
		const calls: string[] = [];
		const client = createLexicalGenerationClient({
			fetchStructured: (async ({ requestLabel }) => {
				calls.push(requestLabel);
				if (requestLabel !== "ResolveSelection") {
					throw new Error(`unexpected requestLabel ${requestLabel}`);
				}

				if (calls.length === 1) {
					return ok({
						discriminator: "VERB",
						lemmaKind: "Lexeme",
						orthographicStatus: "Standard",
						spelledLemma: "geht",
						surfaceKind: "Inflection",
					});
				}

				return ok({
					contextWithLinkedParts: "Er geht auf.",
					discriminator: "VERB",
					lemmaKind: "Lexeme",
					orthographicStatus: "Standard",
					spelledLemma: "aufgehen",
					surfaceKind: "Lemma",
				});
			}) as StructuredFetchFn,
			knownLanguage: "English",
			settings: { generateInflections: true },
			targetLanguage: "German",
		})._unsafeUnwrap();

		const result = await client.resolveSelection("geht", "Er geht auf.");

		expect(result.isOk()).toBe(true);
		expect(result._unsafeUnwrap()).toMatchObject({
			surface: {
				lemma: { pos: "VERB", spelledLemma: "aufgehen" },
				surfaceKind: "Lemma",
			},
		});
		expect(calls).toEqual(["ResolveSelection", "ResolveSelection"]);
	});

	it("matches structured lexical identities at lemma level for disambiguation", async () => {
		const client = createLexicalGenerationClient({
			fetchStructured: (async ({ requestLabel }) => {
				if (requestLabel !== "DisambiguateSense") {
					return ok({});
				}

				return ok({
					senseEmojis: null,
					matchedIndex: 1,
				});
			}) as StructuredFetchFn,
			knownLanguage: "English",
			settings: { generateInflections: true },
			targetLanguage: "German",
		})._unsafeUnwrap();

		const matched = await client.disambiguateSense(
			makeLexemeSelection({
				lemma: "Bank",
				pos: "NOUN",
				spelledSurface: "Banken",
				surfaceKind: "Inflection",
			}),
			"Die Banken sind geschlossen.",
			[
				makeLexemeMeta({
					senseEmojis: ["🏦"],
					lemma: "Bank",
					pos: "NOUN",
				}),
			],
		);

		expect(matched.isOk()).toBe(true);
		expect(matched._unsafeUnwrap()).toEqual({
			cacheIndex: 0,
			kind: "matched",
		});
	});

	it("returns prompt failures as Err for disambiguation", async () => {
		const client = createLexicalGenerationClient({
			fetchStructured: (async ({ requestLabel }) => {
				if (requestLabel === "DisambiguateSense") {
					return err(
						lexicalGenerationError(
							LexicalGenerationFailureKind.FetchFailed,
							"prompt failed",
						),
					);
				}
				return ok({});
			}) as StructuredFetchFn,
			knownLanguage: "English",
			settings: { generateInflections: true },
			targetLanguage: "German",
		})._unsafeUnwrap();

		const result = await client.disambiguateSense(
			makeLexemeSelection({ lemma: "Bank", pos: "NOUN" }),
			"Ich gehe zur Bank",
			[
				makeLexemeMeta({
					senseEmojis: ["🏦"],
					lemma: "Bank",
					pos: "NOUN",
				}),
			],
		);

		expect(result.isErr()).toBe(true);
	});

	it("returns Err instead of throwing on invalid resolved discriminator payloads", async () => {
		const client = createLexicalGenerationClient({
			fetchStructured: (async ({ requestLabel }) => {
				if (requestLabel !== "ResolveSelection") {
					throw new Error(`unexpected requestLabel ${requestLabel}`);
				}

				return ok({
					discriminator: "Cliché",
					lemmaKind: "Lexeme",
					orthographicStatus: "Standard",
					spelledLemma: "Bank",
					surfaceKind: "Lemma",
				});
			}) as StructuredFetchFn,
			knownLanguage: "English",
			settings: { generateInflections: true },
			targetLanguage: "German",
		})._unsafeUnwrap();

		const result = await client.resolveSelection(
			"Bank",
			"Ich sehe die Bank",
		);

		expect(result.isErr()).toBe(true);
		expect(result._unsafeUnwrapErr().kind).toBe(
			LexicalGenerationFailureKind.InvalidModelOutput,
		);
	});

	it("normalizes lexical metadata to lemma identity by default", () => {
		const meta = makeLexemeMeta({
			senseEmojis: ["🏦"],
			lemma: "Bank",
			pos: "NOUN",
		});

		expect(meta.identity.surfaceKind).toBe("Lemma");
	});

	it("returns Err when lexical metadata is requested for an unknown selection", () => {
		const result = createLexicalMeta({
			senseEmojis: ["❓"],
			selection: {
				language: "German",
				orthographicStatus: "Unknown",
				spelledSelection: "???",
			},
		});

		expect(result.isErr()).toBe(true);
		expect(result._unsafeUnwrapErr().kind).toBe(
			LexicalGenerationFailureKind.InvalidSelection,
		);
	});
});
