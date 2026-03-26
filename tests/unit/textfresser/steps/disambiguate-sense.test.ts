import { describe, expect, it } from "bun:test";
import type { VaultActionManager } from "@textfresser/vault-action-manager";
import type { SplitPathToMdFile } from "@textfresser/vault-action-manager/types/split-path";
import { err, ok, type Result } from "neverthrow";
import { disambiguateSense } from "../../../../src/commanders/textfresser/commands/lemma/steps/disambiguate-sense";
import {
	createLexicalMeta,
	type LexicalGenerationError,
	LexicalGenerationFailureKind,
	type LexicalMeta,
	lexicalGenerationError,
	type SenseDisambiguator,
	type SenseMatchResult,
} from "@textfresser/lexical-generation";

const MOCK_SPLIT_PATH: SplitPathToMdFile = {
	basename: "Bank",
	extension: "md",
	kind: "MdFile" as const,
	pathParts: ["Worter"],
};

const API_RESULT_NOUN = {
	lemma: "Bank",
	linguisticUnit: "Lexem",
	posLikeKind: "Noun",
	surfaceKind: "Lemma",
} as const;

const API_RESULT_PHRASEM = {
	lemma: "auf jeden Fall",
	linguisticUnit: "Phrasem",
	posLikeKind: "DiscourseFormula",
	surfaceKind: "Lemma",
} as const;

function splitPathKey(path: SplitPathToMdFile): string {
	return [...path.pathParts, `${path.basename}.${path.extension}`].join("/");
}

function makeVam(opts: {
	files?: SplitPathToMdFile[];
	content?: string;
	contentByPath?: Record<string, string>;
}): VaultActionManager {
	return {
		findByBasename: () => opts.files ?? [],
		readContent: (splitPath: SplitPathToMdFile) => {
			const key = splitPathKey(splitPath);
			const mapped = opts.contentByPath?.[key];
			return Promise.resolve(ok(mapped ?? opts.content ?? ""));
		},
	} as unknown as VaultActionManager;
}

function makeSenseDisambiguator(params: {
	onCall?: (cache: LexicalMeta[]) => void;
	result: Result<SenseMatchResult, LexicalGenerationError>;
}): SenseDisambiguator {
	return async (_lemma, _attestation, cache) => {
		params.onCall?.(cache);
		return params.result;
	};
}

function buildLexemMeta(params: {
	emojiDescription: string[];
	index: number;
	posLikeKind?: "Noun" | "Verb";
	surfaceKind?: "Lemma" | "Inflected";
}): { id: string; lexicalMeta: LexicalMeta } {
	const posLikeKind = params.posLikeKind ?? "Noun";
	const surfaceKind = params.surfaceKind ?? "Lemma";
	const posToken = posLikeKind === "Noun" ? "NOUN" : "VERB";

	return {
		id: `LX-${surfaceKind === "Lemma" ? "LM" : "IN"}-${posToken}-${params.index}`,
		lexicalMeta: createLexicalMeta({
			emojiDescription: params.emojiDescription,
			lemma: {
				lemma: posLikeKind === "Noun" ? "Bank" : "fahren",
				linguisticUnit: "Lexem",
				posLikeKind,
				surfaceKind,
			},
		}),
	};
}

function buildPhrasemMeta(params: {
	emojiDescription: string[];
	index: number;
	posLikeKind?: "DiscourseFormula" | "Collocation";
}): { id: string; lexicalMeta: LexicalMeta } {
	const posLikeKind = params.posLikeKind ?? "DiscourseFormula";

	return {
		id: `PH-LM-${params.index}`,
		lexicalMeta: createLexicalMeta({
			emojiDescription: params.emojiDescription,
			lemma: {
				lemma: "auf jeden Fall",
				linguisticUnit: "Phrasem",
				posLikeKind,
				surfaceKind: "Lemma",
			},
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

describe("disambiguateSense", () => {
	it("returns null when no files found", async () => {
		const result = await disambiguateSense(
			makeVam({ files: [] }),
			API_RESULT_NOUN,
			"context",
		);

		expect(result.isOk()).toBe(true);
		expect(result._unsafeUnwrap()).toBeNull();
	});

	it("passes stored lexical meta through to lexical-generation unchanged", async () => {
		const content = buildNoteContent([
			buildLexemMeta({ emojiDescription: ["🏦"], index: 1 }),
			buildLexemMeta({ emojiDescription: ["🪑"], index: 2 }),
		]);
		let capturedCache: LexicalMeta[] | undefined;

		const result = await disambiguateSense(
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
		);

		expect(result.isOk()).toBe(true);
		expect(capturedCache).toEqual([
			createLexicalMeta({
				emojiDescription: ["🏦"],
				lemma: {
					lemma: "Bank",
					linguisticUnit: "Lexem",
					posLikeKind: "Noun",
					surfaceKind: "Lemma",
				},
			}),
			createLexicalMeta({
				emojiDescription: ["🪑"],
				lemma: {
					lemma: "Bank",
					linguisticUnit: "Lexem",
					posLikeKind: "Noun",
					surfaceKind: "Lemma",
				},
			}),
		]);
		expect(result._unsafeUnwrap()).toEqual({ matchedIndex: 2 });
	});

	it("maps new-sense results through with precomputed emoji", async () => {
		const content = buildNoteContent([
			buildLexemMeta({ emojiDescription: ["🏦"], index: 1 }),
		]);

		const result = await disambiguateSense(
			makeVam({ content, files: [MOCK_SPLIT_PATH] }),
			API_RESULT_NOUN,
			"Sitz auf der Bank",
			undefined,
			{
				disambiguateWith: makeSenseDisambiguator({
					result: ok({
						kind: "new",
						precomputedEmojiDescription: ["🪑", "🌳"],
					}),
				}),
			},
		);

		expect(result.isOk()).toBe(true);
		expect(result._unsafeUnwrap()).toEqual({
			matchedIndex: null,
			precomputedEmojiDescription: ["🪑", "🌳"],
		});
	});

	it("treats out-of-range cache indices as a new sense", async () => {
		const content = buildNoteContent([
			buildLexemMeta({ emojiDescription: ["🏦"], index: 1 }),
		]);

		const result = await disambiguateSense(
			makeVam({ content, files: [MOCK_SPLIT_PATH] }),
			API_RESULT_NOUN,
			"context",
			undefined,
			{
				disambiguateWith: makeSenseDisambiguator({
					result: ok({ cacheIndex: 99, kind: "matched" }),
				}),
			},
		);

		expect(result.isOk()).toBe(true);
		expect(result._unsafeUnwrap()).toEqual({ matchedIndex: null });
	});

	it("ignores entries without lexical meta and still lets lexical-generation decide", async () => {
		const content = buildNoteContent([
			{ id: "LX-LM-NOUN-1" },
		]);
		let capturedCache: LexicalMeta[] | undefined;

		const result = await disambiguateSense(
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
		);

		expect(result.isOk()).toBe(true);
		expect(capturedCache).toEqual([]);
		expect(result._unsafeUnwrap()).toEqual({ matchedIndex: null });
	});

	it("ignores invalid entry ids when assembling lexical meta cache", async () => {
		const content =
			"[[Bank]] ^invalid-id-format\n\n<section id=\"textfresser_meta_keep_me_invisible\">\n" +
			JSON.stringify({
				entries: {
					"INVALID-ID-FORMAT": {
						lexicalMeta: buildLexemMeta({
							emojiDescription: ["🏦"],
							index: 1,
						}).lexicalMeta,
					},
				},
			}) +
			"\n</section>";
		let capturedCache: LexicalMeta[] | undefined;

		const result = await disambiguateSense(
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
		);

		expect(result.isOk()).toBe(true);
		expect(capturedCache).toEqual([]);
		expect(result._unsafeUnwrap()).toEqual({ matchedIndex: null });
	});

	it("supports phraseme lexical meta candidates", async () => {
		const content = buildNoteContent([
			buildPhrasemMeta({ emojiDescription: ["✅"], index: 1 }),
		]);
		let capturedCache: LexicalMeta[] | undefined;

		const result = await disambiguateSense(
			makeVam({
				content,
				files: [{ ...MOCK_SPLIT_PATH, basename: "auf jeden Fall" }],
			}),
			API_RESULT_PHRASEM,
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
		);

		expect(result.isOk()).toBe(true);
		expect(capturedCache?.[0]?.metaTag).toBe("ph|discourse-formula|lemma");
		expect(result._unsafeUnwrap()).toEqual({ matchedIndex: 1 });
	});

	it("returns lexical-generation failures as command errors", async () => {
		const content = buildNoteContent([
			buildLexemMeta({ emojiDescription: ["🏦"], index: 1 }),
		]);

		const result = await disambiguateSense(
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
		);

		expect(result.isErr()).toBe(true);
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
			buildLexemMeta({ emojiDescription: ["🏦"], index: 1 }),
		]);
		const preferredContent = buildNoteContent([
			buildLexemMeta({ emojiDescription: ["💺"], index: 2 }),
		]);

		const result = await disambiguateSense(
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
		);

		expect(result.isOk()).toBe(true);
		expect(result._unsafeUnwrap()).toEqual({ matchedIndex: 2 });
	});
});
