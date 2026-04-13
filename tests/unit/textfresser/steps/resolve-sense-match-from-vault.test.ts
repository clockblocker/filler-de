import { describe, expect, it } from "bun:test";
import type { VaultActionManager } from "@textfresser/vault-action-manager";
import type { SplitPathToMdFile } from "@textfresser/vault-action-manager";
import { err, ok, type Result } from "neverthrow";
import { resolveSenseMatchFromVault } from "../../../../src/commanders/textfresser/commands/lemma/steps/resolve-sense-match-from-vault";
import {
	type LexicalGenerationError,
	LexicalGenerationFailureKind,
	type LexicalMeta,
	lexicalGenerationError,
	type SenseDisambiguator,
	type SenseMatchResult,
} from "@textfresser/lexical-generation";
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

function buildLexemeMeta(params: {
	emojiDescription: string[];
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
			emojiDescription: params.emojiDescription,
			lemma: pos === "NOUN" ? "Bank" : "fahren",
			pos,
			surfaceKind,
		}),
	};
}

function buildPhrasemeMeta(params: {
	emojiDescription: string[];
	index: number;
	phrasemeKind?: "DiscourseFormula";
}): { id: string; lexicalMeta: LexicalMeta } {
	return {
		id: `PH-LM-${params.index}`,
		lexicalMeta: makePhrasemeMeta({
			emojiDescription: params.emojiDescription,
			lemma: "auf jeden Fall",
			phrasemeKind: params.phrasemeKind ?? "DiscourseFormula",
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
		const result = await resolveSenseMatchFromVault(
			makeVam({ files: [] }),
			API_RESULT_NOUN,
			"context",
		);

		expect(result.isOk()).toBe(true);
		expect(result._unsafeUnwrap()).toBeNull();
	});

	it("passes stored lexical meta through to lexical-generation unchanged", async () => {
		const content = buildNoteContent([
			buildLexemeMeta({ emojiDescription: ["🏦"], index: 1 }),
			buildLexemeMeta({ emojiDescription: ["🪑"], index: 2 }),
		]);
		let capturedCache: LexicalMeta[] | undefined;

		const result = await resolveSenseMatchFromVault(
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
			makeLexemeMeta({
				emojiDescription: ["🏦"],
				lemma: "Bank",
				pos: "NOUN",
			}),
			makeLexemeMeta({
				emojiDescription: ["🪑"],
				lemma: "Bank",
				pos: "NOUN",
			}),
		]);
		expect(result._unsafeUnwrap()).toEqual({ matchedIndex: 2 });
	});

	it("maps new-sense results through with precomputed emoji", async () => {
		const content = buildNoteContent([
			buildLexemeMeta({ emojiDescription: ["🏦"], index: 1 }),
		]);

		const result = await resolveSenseMatchFromVault(
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
			buildLexemeMeta({ emojiDescription: ["🏦"], index: 1 }),
		]);

		const result = await resolveSenseMatchFromVault(
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
		const content = buildNoteContent([{ id: "LX-LM-NOUN-1" }]);
		let capturedCache: LexicalMeta[] | undefined;

		const result = await resolveSenseMatchFromVault(
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
						lexicalMeta: buildLexemeMeta({
							emojiDescription: ["🏦"],
							index: 1,
						}).lexicalMeta,
					},
				},
			}) +
			"\n</section>";
		let capturedCache: LexicalMeta[] | undefined;

		const result = await resolveSenseMatchFromVault(
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
			buildPhrasemeMeta({ emojiDescription: ["✅"], index: 1 }),
		]);
		let capturedCache: LexicalMeta[] | undefined;

		const result = await resolveSenseMatchFromVault(
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
		);

		expect(result.isOk()).toBe(true);
		expect(capturedCache?.[0]?.metaTag).toBe("Phraseme|DiscourseFormula|Lemma");
		expect(result._unsafeUnwrap()).toEqual({ matchedIndex: 1 });
	});

	it("returns lexical-generation failures as command errors", async () => {
		const content = buildNoteContent([
			buildLexemeMeta({ emojiDescription: ["🏦"], index: 1 }),
		]);

		const result = await resolveSenseMatchFromVault(
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
			buildLexemeMeta({ emojiDescription: ["🏦"], index: 1 }),
		]);
		const preferredContent = buildNoteContent([
			buildLexemeMeta({ emojiDescription: ["💺"], index: 2 }),
		]);

		const result = await resolveSenseMatchFromVault(
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
