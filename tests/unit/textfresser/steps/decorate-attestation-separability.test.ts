import { describe, expect, it } from "bun:test";
import { decorateAttestationSeparability } from "../../../../src/commanders/textfresser/commands/generate/steps/decorate-attestation-separability";
import type { GenerateSectionsResult } from "../../../../src/commanders/textfresser/commands/generate/steps/generate-sections";
import type { MorphemeItem } from "../../../../src/commanders/textfresser/domain/morpheme/morpheme-formatter";
import type { TextfresserState } from "../../../../src/commanders/textfresser/state/textfresser-state";
import { VaultActionKind } from "../../../../src/managers/obsidian/vault-action-manager/types/vault-action";

const SOURCE_PATH = {
	basename: "chapter-1",
	extension: "md" as const,
	kind: "MdFile" as const,
	pathParts: ["Reading"],
};

function makeCtx(
	morphemes: MorphemeItem[],
	lemma = "aufpassen",
): GenerateSectionsResult {
	return {
		actions: [],
		allEntries: [],
		commandContext: {
			activeFile: {
				content: "",
				splitPath: {
					basename: lemma,
					extension: "md",
					kind: "MdFile",
					pathParts: ["Wörter"],
				},
			},
		},
		existingEntries: [],
		failedSections: [],
		inflectionCells: [],
		matchedEntry: null,
		morphemes,
		nextIndex: 1,
		relations: [],
		resultingActions: [],
		textfresserState: {
			languages: { known: "English", target: "German" },
			latestLemmaResult: {
				attestation: {
					source: {
						path: SOURCE_PATH,
						ref: "![[chapter-1#^1|^]]",
						textRaw: "",
						textWithOnlyTargetMarked: "",
					},
					target: { surface: lemma },
				},
				disambiguationResult: null,
				lemma,
				linguisticUnit: "Lexem",
				posLikeKind: "Verb",
				surfaceKind: "Lemma",
			},
			lookupInLibrary: () => [],
			vam: { findByBasename: () => [] },
		} as unknown as TextfresserState,
	} as unknown as GenerateSectionsResult;
}

function extractTransform(
	result: GenerateSectionsResult,
): ((c: string) => string) | null {
	const action = result.actions.find(
		(a) => a.kind === VaultActionKind.ProcessMdFile,
	);
	if (!action) return null;
	return (action.payload as { transform: (c: string) => string }).transform;
}

describe("decorateAttestationSeparability", () => {
	it("keeps multi-span aliases unchanged for separable verbs", () => {
		const ctx = makeCtx([
			{
				kind: "Prefix",
				linkTarget: "auf-prefix-de",
				separability: "Separable",
				surf: "auf",
			},
			{ kind: "Root", lemma: "passen", surf: "pass" },
		]);
		const result = decorateAttestationSeparability(ctx);
		expect(result.isOk()).toBe(true);

		const transform = extractTransform(result._unsafeUnwrap());
		expect(transform).not.toBeNull();

		const content = "[[aufpassen|Pass]] auf dich [[aufpassen|auf]]";
		const decorated = transform!(content);
		expect(decorated).toBe(content);
	});

	it("skips inseparable verbs (no decoration)", () => {
		const ctx = makeCtx(
			[
				{
					kind: "Prefix",
					linkTarget: "ver-prefix-de",
					separability: "Inseparable",
					surf: "ver",
				},
				{ kind: "Root", lemma: "stehen", surf: "steh" },
			],
			"verstehen",
		);
		const result = decorateAttestationSeparability(ctx);
		expect(result.isOk()).toBe(true);
		// No ProcessMdFile action should be added
		expect(result._unsafeUnwrap().actions).toHaveLength(0);
	});

	it("skips non-verb words (no prefix morpheme)", () => {
		const ctx = makeCtx(
			[
				{ kind: "Root", lemma: "Kropf", surf: "kröpf" },
				{ kind: "Suffix", surf: "chen" },
			],
			"Kröpfchen",
		);
		const result = decorateAttestationSeparability(ctx);
		expect(result.isOk()).toBe(true);
		expect(result._unsafeUnwrap().actions).toHaveLength(0);
	});

	it("skips when only a single wikilink matches (no multi-span)", () => {
		const ctx = makeCtx([
			{
				kind: "Prefix",
				linkTarget: "auf-prefix-de",
				separability: "Separable",
				surf: "auf",
			},
			{ kind: "Root", lemma: "passen", surf: "pass" },
		]);
		const result = decorateAttestationSeparability(ctx);
		expect(result.isOk()).toBe(true);

		const transform = extractTransform(result._unsafeUnwrap());
		expect(transform).not.toBeNull();

		// Only one wikilink → transform should return content unchanged
		const content = "Ich muss [[aufpassen|aufpassen]]";
		const decorated = transform!(content);
		expect(decorated).toBe(content);
	});

	it("skips wikilinks without alias", () => {
		const ctx = makeCtx([
			{
				kind: "Prefix",
				linkTarget: "auf-prefix-de",
				separability: "Separable",
				surf: "auf",
			},
			{ kind: "Root", lemma: "passen", surf: "pass" },
		]);
		const result = decorateAttestationSeparability(ctx);
		const transform = extractTransform(result._unsafeUnwrap());

		// Two wikilinks but neither has alias → count is 0 after filter
		const content = "Ich muss [[aufpassen]] und [[aufpassen]]";
		const decorated = transform!(content);
		expect(decorated).toBe(content);
	});

	it("skips empty morphemes array (re-encounter path)", () => {
		const ctx = makeCtx([]);
		const result = decorateAttestationSeparability(ctx);
		expect(result.isOk()).toBe(true);
		expect(result._unsafeUnwrap().actions).toHaveLength(0);
	});

	it("produces ProcessMdFile action targeting source path, not activeFile", () => {
		const ctx = makeCtx([
			{
				kind: "Prefix",
				linkTarget: "auf-prefix-de",
				separability: "Separable",
				surf: "auf",
			},
			{ kind: "Root", lemma: "passen", surf: "pass" },
		]);
		const result = decorateAttestationSeparability(ctx);
		const actions = result._unsafeUnwrap().actions;

		const processAction = actions.find(
			(a) => a.kind === VaultActionKind.ProcessMdFile,
		);
		expect(processAction).toBeDefined();
		expect(
			(processAction!.payload as { splitPath: typeof SOURCE_PATH })
				.splitPath,
		).toEqual(SOURCE_PATH);
	});

	it("is idempotent: already-decorated wikilinks are not double-decorated", () => {
		const ctx = makeCtx([
			{
				kind: "Prefix",
				linkTarget: "auf-prefix-de",
				separability: "Separable",
				surf: "auf",
			},
			{ kind: "Root", lemma: "passen", surf: "pass" },
		]);
		const result = decorateAttestationSeparability(ctx);
		const transform = extractTransform(result._unsafeUnwrap());

		// Already decorated content
		const content = "[[aufpassen|>Pass]] auf dich [[aufpassen|auf<]]";
		const decorated = transform!(content);
		expect(decorated).toBe(content);
	});

	it("keeps case-variant multi-span aliases unchanged", () => {
		const ctx = makeCtx([
			{
				kind: "Prefix",
				linkTarget: "auf-prefix-de",
				separability: "Separable",
				surf: "auf",
			},
			{ kind: "Root", lemma: "passen", surf: "pass" },
		]);
		const result = decorateAttestationSeparability(ctx);
		const transform = extractTransform(result._unsafeUnwrap());

		// Capitalized prefix alias (e.g., at sentence start)
		const content = "[[aufpassen|Auf]] dich [[aufpassen|Pass]]!";
		const decorated = transform!(content);
		expect(decorated).toBe(content);
	});
});
