import { describe, expect, it } from "bun:test";
import type { GenerateSectionsResult } from "../../../../src/commanders/textfresser/commands/generate/steps/generate-sections";
import { propagateRelations } from "../../../../src/commanders/textfresser/commands/generate/steps/propagate-relations";
import type { TextfresserState } from "../../../../src/commanders/textfresser/state/textfresser-state";
import { VaultActionKind } from "../../../../src/managers/obsidian/vault-action-manager/types/vault-action";

function makeCtx(
	relations: GenerateSectionsResult["relations"],
	lemma = "Kohlekraftwerk",
): GenerateSectionsResult {
	return {
		actions: [],
		allEntries: [],
		commandContext: {
			activeFile: { content: "", splitPath: { basename: lemma, extension: "md", kind: "MdFile", pathParts: [] } },
		},
		existingEntries: [],
		failedSections: [],
		inflectionCells: [],
		matchedEntry: null,
		nextIndex: 1,
		relations,
		resultingActions: [],
		textfresserState: {
			languages: { known: "English", target: "German" },
			latestLemmaResult: {
				attestation: { source: { ref: "![[Test#^1|^]]" } },
				disambiguationResult: null,
				lemma,
				linguisticUnit: "Lexem",
				posLikeKind: "Noun",
				surfaceKind: "Lemma",
			},
			lookupInLibrary: () => [],
			vam: { findByBasename: () => [] },
		} as unknown as TextfresserState,
	} as unknown as GenerateSectionsResult;
}

describe("propagateRelations", () => {
	it("returns ok with no extra actions when relations are empty", () => {
		const ctx = makeCtx([]);
		const result = propagateRelations(ctx);
		expect(result.isOk()).toBe(true);
		expect(result._unsafeUnwrap().actions).toHaveLength(0);
	});

	it("creates UpsertMdFile + ProcessMdFile pair for each target word", () => {
		const ctx = makeCtx([
			{ kind: "Synonym", words: ["Kraftwerk", "Anlage"] },
		]);
		const result = propagateRelations(ctx);
		expect(result.isOk()).toBe(true);

		const actions = result._unsafeUnwrap().actions;
		// 2 target words × 2 actions each (Upsert + Process)
		expect(actions).toHaveLength(4);

		expect(actions[0]!.kind).toBe(VaultActionKind.UpsertMdFile);
		expect(actions[1]!.kind).toBe(VaultActionKind.ProcessMdFile);
		expect(actions[2]!.kind).toBe(VaultActionKind.UpsertMdFile);
		expect(actions[3]!.kind).toBe(VaultActionKind.ProcessMdFile);
	});

	it("skips self-references", () => {
		const ctx = makeCtx([
			{ kind: "Synonym", words: ["Kohlekraftwerk", "Anlage"] },
		]);
		const result = propagateRelations(ctx);
		expect(result.isOk()).toBe(true);

		// Only "Anlage" gets propagation (self-ref "Kohlekraftwerk" skipped)
		const actions = result._unsafeUnwrap().actions;
		expect(actions).toHaveLength(2);
	});

	it("ProcessMdFile transform appends inverse relation to empty content", () => {
		const ctx = makeCtx([
			{ kind: "Hypernym", words: ["Anlage"] },
		]);
		const result = propagateRelations(ctx);
		const actions = result._unsafeUnwrap().actions;

		// The ProcessMdFile action has a transform function
		const processAction = actions.find(
			(a) => a.kind === VaultActionKind.ProcessMdFile,
		)!;
		const transform = (processAction.payload as { transform: (c: string) => string }).transform;

		// Apply transform to empty content → should create section with inverse relation
		const output = transform("");
		// Hypernym → inverse is Hyponym (⊂)
		expect(output).toContain("⊂ [[Kohlekraftwerk]]");
	});

	it("generates healing action when target found in inflected folder", () => {
		const inflectedPath = {
			basename: "Anlage",
			extension: "md" as const,
			kind: "MdFile" as const,
			pathParts: ["Worter", "de", "lexem", "inflected", "a", "anl", "anlag"],
		};
		const ctx = makeCtx([
			{ kind: "Synonym", words: ["Anlage"] },
		]);
		// Override vam to return inflected path
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		(ctx.textfresserState as any).vam = {
			findByBasename: (name: string) => name === "Anlage" ? [inflectedPath] : [],
		};

		const result = propagateRelations(ctx);
		expect(result.isOk()).toBe(true);

		const actions = result._unsafeUnwrap().actions;
		// Should have: RenameMdFile (healing) + UpsertMdFile + ProcessMdFile = 3
		expect(actions).toHaveLength(3);
		expect(actions[0]!.kind).toBe(VaultActionKind.RenameMdFile);
		expect(actions[1]!.kind).toBe(VaultActionKind.UpsertMdFile);
		expect(actions[2]!.kind).toBe(VaultActionKind.ProcessMdFile);
	});

	it("ProcessMdFile transform deduplicates existing relations", () => {
		const ctx = makeCtx([
			{ kind: "Synonym", words: ["Anlage"] },
		]);
		const result = propagateRelations(ctx);
		const actions = result._unsafeUnwrap().actions;

		const processAction = actions.find(
			(a) => a.kind === VaultActionKind.ProcessMdFile,
		)!;
		const transform = (processAction.payload as { transform: (c: string) => string }).transform;

		// First application adds the line
		const first = transform("");
		expect(first).toContain("= [[Kohlekraftwerk]]");

		// Second application should not duplicate
		const second = transform(first);
		const matches = second.match(/= \[\[Kohlekraftwerk\]\]/g);
		expect(matches).toHaveLength(1);
	});
});
