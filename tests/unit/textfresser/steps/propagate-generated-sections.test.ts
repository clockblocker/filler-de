import { describe, expect, it } from "bun:test";
import { propagateGeneratedSections } from "../../../../src/commanders/textfresser/commands/generate/steps/propagate-generated-sections";
import type {
	GenerateSectionsResult,
	ParsedRelation,
} from "../../../../src/commanders/textfresser/commands/generate/steps/generate-sections";
import type { MorphemeItem } from "../../../../src/commanders/textfresser/domain/morpheme/morpheme-formatter";
import type { TextfresserState } from "../../../../src/commanders/textfresser/state/textfresser-state";
import { VaultActionKind } from "../../../../src/managers/obsidian/vault-action-manager/types/vault-action";

const SOURCE_PATH = {
	basename: "chapter-1",
	extension: "md" as const,
	kind: "MdFile" as const,
	pathParts: ["Reading"],
};

function makeCtx(params?: {
	morphemes?: MorphemeItem[];
	relations?: ParsedRelation[];
}): GenerateSectionsResult {
	const morphemes = params?.morphemes ?? [];
	const relations = params?.relations ?? [];

	return {
		actions: [],
		allEntries: [],
		commandContext: {
			activeFile: {
				content: "",
				splitPath: {
					basename: "aufpassen",
					extension: "md",
					kind: "MdFile",
					pathParts: ["Worter"],
				},
			},
		},
		existingEntries: [],
		failedSections: [],
		inflectionCells: [],
		matchedEntry: null,
		morphemes,
		nextIndex: 1,
		relations,
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
					target: { surface: "aufpassen" },
				},
				disambiguationResult: null,
				lemma: "aufpassen",
				linguisticUnit: "Lexem",
				posLikeKind: "Verb",
				surfaceKind: "Lemma",
			},
			lookupInLibrary: () => [],
			vam: { findByBasename: () => [] },
		} as unknown as TextfresserState,
	} as unknown as GenerateSectionsResult;
}

describe("propagateGeneratedSections", () => {
	it("runs core propagation and the source-note post-step together", async () => {
		const result = propagateGeneratedSections(
			makeCtx({
				morphemes: [
					{
						kind: "Prefix",
						linkTarget: "auf-prefix-de",
						separability: "Separable",
						surf: "auf",
					},
				],
				relations: [{ kind: "Synonym", words: ["Heim"] }],
			}),
		);
		expect(result.isOk()).toBe(true);
		if (result.isErr()) return;

		const actions = result.value.actions;
		const upsertCount = actions.filter(
			(action) => action.kind === VaultActionKind.UpsertMdFile,
		).length;
		expect(upsertCount).toBeGreaterThan(0);

		const sourceProcess = actions.find(
			(action) =>
				action.kind === VaultActionKind.ProcessMdFile &&
				action.payload.splitPath.basename === SOURCE_PATH.basename &&
				action.payload.splitPath.pathParts.join("/") ===
					SOURCE_PATH.pathParts.join("/"),
		);
		expect(sourceProcess).toBeDefined();
		if (!sourceProcess || !("transform" in sourceProcess.payload)) return;

		const sample = "[[aufpassen|Pass]] auf dich [[aufpassen|auf]]";
		const transformed = await sourceProcess.payload.transform(sample);
		expect(transformed).toBe(sample);
	});

	it("is a no-op when neither propagation nor post-step conditions apply", () => {
		const result = propagateGeneratedSections(makeCtx());
		expect(result.isOk()).toBe(true);
		if (result.isErr()) return;
		expect(result.value.actions).toHaveLength(0);
	});
});
