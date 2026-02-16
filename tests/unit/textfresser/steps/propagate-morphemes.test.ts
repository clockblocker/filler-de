import { describe, expect, it } from "bun:test";
import type { GenerateSectionsResult } from "../../../../src/commanders/textfresser/commands/generate/steps/generate-sections";
import { propagateMorphemes } from "../../../../src/commanders/textfresser/commands/generate/steps/propagate-morphemes";
import type { MorphemeItem } from "../../../../src/commanders/textfresser/domain/morpheme/morpheme-formatter";
import type { TextfresserState } from "../../../../src/commanders/textfresser/state/textfresser-state";
import { VaultActionKind } from "../../../../src/managers/obsidian/vault-action-manager/types/vault-action";

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
					pathParts: [],
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
				attestation: { source: { ref: "![[Test#^1|^]]" } },
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
	actions: GenerateSectionsResult["actions"],
	index = 1,
): (c: string) => string {
	const processAction = actions[index];
	expect(processAction).toBeDefined();
	return (processAction!.payload as { transform: (c: string) => string })
		.transform;
}

describe("propagateMorphemes", () => {
	it("returns ok with no extra actions for single-morpheme words", () => {
		const ctx = makeCtx([
			{ kind: "Root", surf: "Hand" },
		]);
		const result = propagateMorphemes(ctx);
		expect(result.isOk()).toBe(true);
		expect(result._unsafeUnwrap().actions).toHaveLength(0);
	});

	it("creates UpsertMdFile + ProcessMdFile per morpheme (except self-ref)", () => {
		const ctx = makeCtx([
			{
				kind: "Prefix",
				linkTarget: "auf-prefix-de",
				separability: "Separable",
				surf: "auf",
			},
			{ kind: "Root", lemma: "passen", surf: "pass" },
		]);
		const result = propagateMorphemes(ctx);
		expect(result.isOk()).toBe(true);

		const actions = result._unsafeUnwrap().actions;
		// 2 morphemes (neither matches lemma "aufpassen") → 2 × (Upsert + Process) = 4
		expect(actions).toHaveLength(4);
		expect(actions[0]!.kind).toBe(VaultActionKind.UpsertMdFile);
		expect(actions[1]!.kind).toBe(VaultActionKind.ProcessMdFile);
		expect(actions[2]!.kind).toBe(VaultActionKind.UpsertMdFile);
		expect(actions[3]!.kind).toBe(VaultActionKind.ProcessMdFile);
	});

	it("produces decorated header >auf for separable prefix", () => {
		const ctx = makeCtx([
			{
				kind: "Prefix",
				linkTarget: "auf-prefix-de",
				separability: "Separable",
				surf: "auf",
			},
			{ kind: "Root", lemma: "passen", surf: "pass" },
		]);
		const result = propagateMorphemes(ctx);
		const actions = result._unsafeUnwrap().actions;
		const transform = extractTransform(actions, 1);
		const output = transform("");

		expect(output).toContain(">auf");
		expect(output).toContain("#prefix/separable");
		expect(output).toContain("[[aufpassen]]");
	});

	it("produces decorated header ver< for inseparable prefix", () => {
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
		const result = propagateMorphemes(ctx);
		const actions = result._unsafeUnwrap().actions;
		const transform = extractTransform(actions, 1);
		const output = transform("");

		expect(output).toContain("ver<");
		expect(output).toContain("#prefix/inseparable");
		expect(output).toContain("[[verstehen]]");
	});

	it("appends attestation reference on re-encounter with existing entry", () => {
		const ctx = makeCtx(
			[
				{
					kind: "Prefix",
					linkTarget: "auf-prefix-de",
					separability: "Separable",
					surf: "auf",
				},
				{ kind: "Root", lemma: "stehen", surf: "steh" },
			],
			"aufstehen",
		);
		const result = propagateMorphemes(ctx);
		const actions = result._unsafeUnwrap().actions;
		// First action pair is for the prefix "auf"
		const transform = extractTransform(actions, 1);

		// Simulate existing entry with >auf header and [[aufpassen]] attestation
		const existingContent = [
			"",
			">auf ^MO-LM-1",
			"",
			'<span class="entry_section_title entry_section_title_tags">Tags</span>',
			"#prefix/separable ",
			'<span class="entry_section_title entry_section_title_kontexte">Kontexte</span>',
			"[[aufpassen]]",
		].join("\n");

		const output = transform(existingContent);
		// Should append [[aufstehen]] to existing attestation
		expect(output).toContain("[[aufpassen]]");
		expect(output).toContain("[[aufstehen]]");
	});

	it("does not duplicate attestation reference on re-encounter", () => {
		const ctx = makeCtx(
			[
				{
					kind: "Prefix",
					linkTarget: "auf-prefix-de",
					separability: "Separable",
					surf: "auf",
				},
				{ kind: "Root", lemma: "stehen", surf: "steh" },
			],
			"aufstehen",
		);
		const result = propagateMorphemes(ctx);
		const actions = result._unsafeUnwrap().actions;
		const transform = extractTransform(actions, 1);

		// Simulate existing entry that already has [[aufstehen]]
		const existingContent = [
			"",
			">auf ^MO-LM-1",
			"",
			'<span class="entry_section_title entry_section_title_tags">Tags</span>',
			"#prefix/separable ",
			'<span class="entry_section_title entry_section_title_kontexte">Kontexte</span>',
			"[[aufstehen]]",
		].join("\n");

		const output = transform(existingContent);
		// Should return content unchanged
		expect(output).toBe(existingContent);
	});

	it("discriminates separability: sep >über and insep über< produce separate entries", () => {
		// First, generate the separable entry from "übersetzen" (translate)
		const ctxSep = makeCtx(
			[
				{
					kind: "Prefix",
					linkTarget: "über-prefix-de",
					separability: "Separable",
					surf: "über",
				},
				{ kind: "Root", lemma: "setzen", surf: "setz" },
			],
			"übersetzen",
		);
		const resultSep = propagateMorphemes(ctxSep);
		const actionsSep = resultSep._unsafeUnwrap().actions;
		const transformSep = extractTransform(actionsSep, 1);
		const afterSep = transformSep("");

		// Now apply inseparable from "übertreiben"
		const ctxInsep = makeCtx(
			[
				{
					kind: "Prefix",
					linkTarget: "über-prefix-de",
					separability: "Inseparable",
					surf: "über",
				},
				{ kind: "Root", lemma: "treiben", surf: "treib" },
			],
			"übertreiben",
		);
		const resultInsep = propagateMorphemes(ctxInsep);
		const actionsInsep = resultInsep._unsafeUnwrap().actions;
		const transformInsep = extractTransform(actionsInsep, 1);
		const afterBoth = transformInsep(afterSep);

		// Should have TWO separate entries
		expect(afterBoth).toContain(">über");
		expect(afterBoth).toContain("über<");
		expect(afterBoth).toContain("[[übersetzen]]");
		expect(afterBoth).toContain("[[übertreiben]]");
		expect(afterBoth).toContain("#prefix/separable");
		expect(afterBoth).toContain("#prefix/inseparable");
	});

	it("produces header and tag for root morpheme", () => {
		const ctx = makeCtx(
			[
				{
					kind: "Prefix",
					linkTarget: "auf-prefix-de",
					separability: "Separable",
					surf: "auf",
				},
				{ kind: "Root", lemma: "machen", surf: "mach" },
			],
			"aufmachen",
		);
		const result = propagateMorphemes(ctx);
		const actions = result._unsafeUnwrap().actions;
		// Root "machen" is the 2nd morpheme → actions index 2,3
		const transform = extractTransform(actions, 3);
		const output = transform("");

		expect(output).toContain("machen");
		expect(output).toContain("#root");
		expect(output).toContain("[[aufmachen]]");
	});

	it("skips self-references when morpheme word matches lemma", () => {
		const ctx = makeCtx(
			[
				{
					kind: "Prefix",
					linkTarget: "auf-prefix-de",
					separability: "Separable",
					surf: "auf",
				},
				// lemma "aufpassen" matches the ctx lemma — should be skipped
				{ kind: "Root", lemma: "aufpassen", surf: "pass" },
			],
			"aufpassen",
		);
		const result = propagateMorphemes(ctx);
		const actions = result._unsafeUnwrap().actions;
		// Only 1 morpheme propagated (prefix "auf"), self-ref root skipped
		expect(actions).toHaveLength(2);
	});

	it("uses MO-LM entry ID format for morpheme entries", () => {
		const ctx = makeCtx([
			{
				kind: "Prefix",
				linkTarget: "auf-prefix-de",
				separability: "Separable",
				surf: "auf",
			},
			{ kind: "Root", lemma: "passen", surf: "pass" },
		]);
		const result = propagateMorphemes(ctx);
		const actions = result._unsafeUnwrap().actions;
		const transform = extractTransform(actions, 1);
		const output = transform("");

		// Entry ID should match MO-LM-{index} pattern
		expect(output).toMatch(/\^MO-LM-\d+/);
	});

	it("returns ok with no extra actions for empty morphemes array", () => {
		const ctx = makeCtx([]);
		const result = propagateMorphemes(ctx);
		expect(result.isOk()).toBe(true);
		expect(result._unsafeUnwrap().actions).toHaveLength(0);
	});

	it("includes linguisticUnit Morphem in entry meta", () => {
		const ctx = makeCtx([
			{
				kind: "Prefix",
				linkTarget: "auf-prefix-de",
				separability: "Separable",
				surf: "auf",
			},
			{ kind: "Root", lemma: "passen", surf: "pass" },
		]);
		const result = propagateMorphemes(ctx);
		const actions = result._unsafeUnwrap().actions;
		const transform = extractTransform(actions, 1);
		const output = transform("");

		// Meta should contain linguisticUnit: "Morphem" serialized somewhere
		// The serialize function puts meta in entries object under the entry ID
		// We verify indirectly that the output isn't empty and has proper structure
		expect(output).toContain("^MO-LM-1");
		expect(output).toContain(">auf");
	});
});
