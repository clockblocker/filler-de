import { describe, expect, it } from "bun:test";
import {
	type LexicalGenerationError,
	LexicalGenerationFailureKind,
	type LexicalMeta,
	lexicalGenerationError,
	type SenseDisambiguator,
	type SenseMatchResult,
} from "@textfresser/lexical-generation";
import type { SplitPathToMdFile, VaultActionManager } from "@textfresser/vault-action-manager";
import { Effect, Result as EffectResult } from "effect";
import { err, type Result as NeverthrowResult, ok } from "neverthrow";
import { resolveSenseMatchFromVault } from "../../../../src/commanders/textfresser/commands/lemma/steps/resolve-sense-match-from-vault";
import {
	makeLexemeMeta,
	makeLexemeSelection,
	makePhrasemeMeta,
	makePhrasemeSelection,
} from "../helpers/native-fixtures";

const MOCK_SPLIT_PATH: SplitPathToMdFile = {
	basename: "Bank",
	extension: "md",
	kind: "MdFile" as const,
	pathParts: ["Worter"],
};

const API_RESULT_NOUN = makeLexemeSelection({
	lemma: "Bank",
	pos: "NOUN",
});

const API_RESULT_PHRASEME = makePhrasemeSelection({
	lemma: "auf jeden Fall",
	phrasemeKind: "DiscourseFormula",
});

function splitPathKey(path: SplitPathToMdFile): string {
	return [...path.pathParts, `${path.basename}.${path.extension}`].join("/");
}

function makeVam(opts: {
	files?: SplitPathToMdFile[];
	content?: string;
	contentByPath?: Record<string, string>;
}): VaultActionManager {
	return {
		findByBasename: () => Effect.succeed(opts.files ?? []),
		readContent: (splitPath: SplitPathToMdFile) => {
			const key = splitPathKey(splitPath);
			const mapped = opts.contentByPath?.[key];
			return Effect.succeed(mapped ?? opts.content ?? "");
		},
	} as unknown as VaultActionManager;
}

function makeSenseDisambiguator(params: {
	onCall?: (cache: LexicalMeta[]) => void;
	result: NeverthrowResult<SenseMatchResult, LexicalGenerationError>;
}): SenseDisambiguator {
	return async (_lemma, _attestation, cache) => {
		params.onCall?.(cache);
		return params.result;
	};
}

function buildLexemeMeta(params: {
	senseEmojis: string[];
	index: number;
	pos?: "NOUN" | "VERB";
	surfaceKind?: "Lemma" | "Inflection";
}): { id: string; lexicalMeta: LexicalMeta } {
	const pos = params.pos ?? "NOUN";
	const surfaceKind = params.surfaceKind ?? "Lemma";
	const posToken = pos === "NOUN" ? "NOUN" : "VERB";

	return {
		id: `LX-${surfaceKind === "Lemma" ? "LM" : "IN"}-${posToken}-${params.index}`,
		lexicalMeta: makeLexemeMeta({
			lemma: pos === "NOUN" ? "Bank" : "fahren",
			pos,
			senseEmojis: params.senseEmojis,
			surfaceKind,
		}),
	};
}

function buildPhrasemeMeta(params: {
	senseEmojis: string[];
	index: number;
	phrasemeKind?: "DiscourseFormula";
}): { id: string; lexicalMeta: LexicalMeta } {
	return {
		id: `PH-LM-${params.index}`,
		lexicalMeta: makePhrasemeMeta({
			lemma: "auf jeden Fall",
			phrasemeKind: params.phrasemeKind ?? "DiscourseFormula",
			senseEmojis: params.senseEmojis,
		}),
	};
}

function buildNoteContent(
	entries: Array<{
		id: string;
		lexicalMeta?: LexicalMeta;
	}>,
): string {
	const body = entries
		.map((entry) => `[[Bank]] ^${entry.id}`)
		.join("\n\n\n---\n---\n\n\n");

	const metaEntries: Record<string, { lexicalMeta?: LexicalMeta }> = {};
	for (const entry of entries) {
		metaEntries[entry.id.toUpperCase()] = entry.lexicalMeta
			? { lexicalMeta: entry.lexicalMeta }
			: {};
	}

	return `${body}\n\n<section id="textfresser_meta_keep_me_invisible">\n${JSON.stringify({ entries: metaEntries })}\n</section>`;
}

describe("resolveSenseMatchFromVault", () => {
	it("returns null when no files found", async () => {
		const result = await Effect.runPromise(resolveSenseMatchFromVault(
			makeVam({ files: [] }),
			API_RESULT_NOUN,
			"context",
		).pipe(Effect.result));

		expect(EffectResult.isSuccess(result)).toBe(true);
		if (EffectResult.isFailure(result)) return;
		expect(result.success).toBeNull();
	});

	it("passes stored lexical meta through to lexical-generation unchanged", async () => {
		const content = buildNoteContent([
			buildLexemeMeta({ index: 1, senseEmojis: ["🏦"] }),
			buildLexemeMeta({ index: 2, senseEmojis: ["🪑"] }),
		]);
		let capturedCache: LexicalMeta[] | undefined;

		const result = await Effect.runPromise(resolveSenseMatchFromVault(
			makeVam({ content, files: [MOCK_SPLIT_PATH] }),
			API_RESULT_NOUN,
			"context",
			undefined,
			{
				disambiguateWith: makeSenseDisambiguator({
					onCall: (cache) => {
						capturedCache = cache;
					},
					result: ok({ cacheIndex: 1, kind: "matched" }),
				}),
			},
		).pipe(Effect.result));

		expect(EffectResult.isSuccess(result)).toBe(true);
		if (EffectResult.isFailure(result)) return;
		expect(capturedCache).toEqual([
			makeLexemeMeta({
				lemma: "Bank",
				pos: "NOUN",
				senseEmojis: ["🏦"],
			}),
			makeLexemeMeta({
				lemma: "Bank",
				pos: "NOUN",
				senseEmojis: ["🪑"],
			}),
		]);
		expect(result.success).toEqual({ matchedIndex: 2 });
	});

	it("maps new-sense results through with precomputed emoji", async () => {
		const content = buildNoteContent([
			buildLexemeMeta({ index: 1, senseEmojis: ["🏦"] }),
		]);

		const result = await Effect.runPromise(resolveSenseMatchFromVault(
			makeVam({ content, files: [MOCK_SPLIT_PATH] }),
			API_RESULT_NOUN,
			"Sitz auf der Bank",
			undefined,
			{
				disambiguateWith: makeSenseDisambiguator({
					result: ok({
						kind: "new",
						precomputedSenseEmojis: ["🪑", "🌳"],
					}),
				}),
			},
		).pipe(Effect.result));

		expect(EffectResult.isSuccess(result)).toBe(true);
		if (EffectResult.isFailure(result)) return;
		expect(result.success).toEqual({
			matchedIndex: null,
			precomputedSenseEmojis: ["🪑", "🌳"],
		});
	});

	it("treats out-of-range cache indices as a new sense", async () => {
		const content = buildNoteContent([
			buildLexemeMeta({ index: 1, senseEmojis: ["🏦"] }),
		]);

		const result = await Effect.runPromise(resolveSenseMatchFromVault(
			makeVam({ content, files: [MOCK_SPLIT_PATH] }),
			API_RESULT_NOUN,
			"context",
			undefined,
			{
				disambiguateWith: makeSenseDisambiguator({
					result: ok({ cacheIndex: 99, kind: "matched" }),
				}),
			},
		).pipe(Effect.result));

		expect(EffectResult.isSuccess(result)).toBe(true);
		if (EffectResult.isFailure(result)) return;
		expect(result.success).toEqual({ matchedIndex: null });
	});

	it("ignores entries without lexical meta and still lets lexical-generation decide", async () => {
		const content = buildNoteContent([{ id: "LX-LM-NOUN-1" }]);
		let capturedCache: LexicalMeta[] | undefined;

		const result = await Effect.runPromise(resolveSenseMatchFromVault(
			makeVam({ content, files: [MOCK_SPLIT_PATH] }),
			API_RESULT_NOUN,
			"context",
			undefined,
			{
				disambiguateWith: makeSenseDisambiguator({
					onCall: (cache) => {
						capturedCache = cache;
					},
					result: ok({ kind: "new" }),
				}),
			},
		).pipe(Effect.result));

		expect(EffectResult.isSuccess(result)).toBe(true);
		if (EffectResult.isFailure(result)) return;
		expect(capturedCache).toEqual([]);
		expect(result.success).toEqual({ matchedIndex: null });
	});

	it("ignores invalid entry ids when assembling lexical meta cache", async () => {
		const content =
			"[[Bank]] ^invalid-id-format\n\n<section id=\"textfresser_meta_keep_me_invisible\">\n" +
			JSON.stringify({
				entries: {
					"INVALID-ID-FORMAT": {
						lexicalMeta: buildLexemeMeta({
							index: 1,
							senseEmojis: ["🏦"],
						}).lexicalMeta,
					},
				},
			}) +
			"\n</section>";
		let capturedCache: LexicalMeta[] | undefined;

		const result = await Effect.runPromise(resolveSenseMatchFromVault(
			makeVam({ content, files: [MOCK_SPLIT_PATH] }),
			API_RESULT_NOUN,
			"context",
			undefined,
			{
				disambiguateWith: makeSenseDisambiguator({
					onCall: (cache) => {
						capturedCache = cache;
					},
					result: ok({ kind: "new" }),
				}),
			},
		).pipe(Effect.result));

		expect(EffectResult.isSuccess(result)).toBe(true);
		if (EffectResult.isFailure(result)) return;
		expect(capturedCache).toEqual([]);
		expect(result.success).toEqual({ matchedIndex: null });
	});

	it("supports phraseme lexical meta candidates", async () => {
		const content = buildNoteContent([
			buildPhrasemeMeta({ index: 1, senseEmojis: ["✅"] }),
		]);
		let capturedCache: LexicalMeta[] | undefined;

		const result = await Effect.runPromise(resolveSenseMatchFromVault(
			makeVam({
				content,
				files: [{ ...MOCK_SPLIT_PATH, basename: "auf jeden Fall" }],
			}),
			API_RESULT_PHRASEME,
			"context",
			undefined,
			{
				disambiguateWith: makeSenseDisambiguator({
					onCall: (cache) => {
						capturedCache = cache;
					},
					result: ok({ cacheIndex: 0, kind: "matched" }),
				}),
			},
		).pipe(Effect.result));

		expect(EffectResult.isSuccess(result)).toBe(true);
		if (EffectResult.isFailure(result)) return;
		expect(capturedCache?.[0]?.metaTag).toBe("Phraseme|DiscourseFormula|Lemma");
		expect(result.success).toEqual({ matchedIndex: 1 });
	});

	it("returns lexical-generation failures as command errors", async () => {
		const content = buildNoteContent([
			buildLexemeMeta({ index: 1, senseEmojis: ["🏦"] }),
		]);

		const result = await Effect.runPromise(resolveSenseMatchFromVault(
			makeVam({ content, files: [MOCK_SPLIT_PATH] }),
			API_RESULT_NOUN,
			"context",
			undefined,
			{
				disambiguateWith: makeSenseDisambiguator({
					result: err(
						lexicalGenerationError(
							LexicalGenerationFailureKind.FetchFailed,
							"API error",
						),
					),
				}),
			},
		).pipe(Effect.result));

		expect(EffectResult.isFailure(result)).toBe(true);
	});

	it("uses preferred target path before basename fallback", async () => {
		const fallbackPath: SplitPathToMdFile = {
			...MOCK_SPLIT_PATH,
			pathParts: ["Worter", "de", "lexem", "lemma", "b", "ban", "bank"],
		};
		const preferredPath: SplitPathToMdFile = {
			...MOCK_SPLIT_PATH,
			pathParts: ["Library", "de", "noun"],
		};
		const fallbackContent = buildNoteContent([
			buildLexemeMeta({ index: 1, senseEmojis: ["🏦"] }),
		]);
		const preferredContent = buildNoteContent([
			buildLexemeMeta({ index: 2, senseEmojis: ["💺"] }),
		]);

		const result = await Effect.runPromise(resolveSenseMatchFromVault(
			makeVam({
				contentByPath: {
					[splitPathKey(fallbackPath)]: fallbackContent,
					[splitPathKey(preferredPath)]: preferredContent,
				},
				files: [fallbackPath],
			}),
			API_RESULT_NOUN,
			"context",
			preferredPath,
			{
				disambiguateWith: makeSenseDisambiguator({
					result: ok({ cacheIndex: 0, kind: "matched" }),
				}),
			},
		).pipe(Effect.result));

		expect(EffectResult.isSuccess(result)).toBe(true);
		if (EffectResult.isFailure(result)) return;
		expect(result.success).toEqual({ matchedIndex: 2 });
	});
});
