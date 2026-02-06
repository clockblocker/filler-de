import { describe, expect, it } from "bun:test";
import { propagateInflections } from "../../../../src/commanders/textfresser/commands/generate/steps/propagate-inflections";
import type { GenerateSectionsResult } from "../../../../src/commanders/textfresser/commands/generate/steps/generate-sections";
import type { NounInflectionCell } from "../../../../src/linguistics/german/inflection/noun";
import { VaultActionKind } from "../../../../src/managers/obsidian/vault-action-manager/types/vault-action";
import type { TextfresserState } from "../../../../src/commanders/textfresser/textfresser";

function makeCtx(
	inflectionCells: NounInflectionCell[],
	lemma = "Kraftwerk",
): GenerateSectionsResult {
	return {
		inflectionCells,
		allEntries: [
			{
				id: "LX-LM-NOUN-1",
				headerContent: `[[${lemma}]]`,
				sections: [],
				meta: {},
			},
		],
		existingEntries: [],
		matchedEntry: null,
		nextIndex: 1,
		relations: [],
		failedSections: [],
		actions: [],
		resultingActions: [],
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
		textfresserState: {
			latestLemmaResult: {
				lemma,
				linguisticUnit: "Lexem",
				pos: "Noun",
				surfaceKind: "Lemma",
				attestation: { source: { ref: "![[Test#^1|^]]" } },
				disambiguationResult: null,
			},
			languages: { known: "English", target: "German" },
		} as unknown as TextfresserState,
	} as unknown as GenerateSectionsResult;
}

describe("propagateInflections", () => {
	it("returns ok with no extra actions when inflectionCells are empty", () => {
		const ctx = makeCtx([]);
		const result = propagateInflections(ctx);
		expect(result.isOk()).toBe(true);
		expect(result._unsafeUnwrap().actions).toHaveLength(0);
	});

	it("creates UpsertMdFile + ProcessMdFile for forms different from lemma", () => {
		const cells: NounInflectionCell[] = [
			{ case: "Nominative", number: "Plural", article: "die", form: "Kraftwerke" },
		];
		const ctx = makeCtx(cells);
		const result = propagateInflections(ctx);
		expect(result.isOk()).toBe(true);

		const actions = result._unsafeUnwrap().actions;
		expect(actions).toHaveLength(2);
		expect(actions[0]!.kind).toBe(VaultActionKind.UpsertMdFile);
		expect(actions[1]!.kind).toBe(VaultActionKind.ProcessMdFile);
	});

	it("appends same-note entry when form equals lemma", () => {
		const cells: NounInflectionCell[] = [
			{ case: "Nominative", number: "Singular", article: "das", form: "Kraftwerk" },
			{ case: "Accusative", number: "Singular", article: "das", form: "Kraftwerk" },
		];
		const ctx = makeCtx(cells);
		const result = propagateInflections(ctx);
		expect(result.isOk()).toBe(true);

		// No new VaultActions (same-note entries don't need separate file operations)
		expect(result._unsafeUnwrap().actions).toHaveLength(0);

		// But allEntries should have a new entry appended
		const entries = result._unsafeUnwrap().allEntries;
		expect(entries.length).toBeGreaterThan(1);

		// The appended entry header should combine cases
		const stubEntry = entries[entries.length - 1]!;
		expect(stubEntry.headerContent).toContain("Nominativ");
		expect(stubEntry.headerContent).toContain("Akkusativ");
		expect(stubEntry.headerContent).toContain("[[Kraftwerk]]");
	});

	it("groups multiple cells by form word", () => {
		const cells: NounInflectionCell[] = [
			{ case: "Nominative", number: "Plural", article: "die", form: "Kraftwerke" },
			{ case: "Accusative", number: "Plural", article: "die", form: "Kraftwerke" },
			{ case: "Genitive", number: "Plural", article: "der", form: "Kraftwerke" },
			{ case: "Dative", number: "Plural", article: "den", form: "Kraftwerken" },
		];
		const ctx = makeCtx(cells);
		const result = propagateInflections(ctx);
		expect(result.isOk()).toBe(true);

		// 2 distinct forms: "Kraftwerke" and "Kraftwerken" → 2 × (Upsert + Process) = 4 actions
		const actions = result._unsafeUnwrap().actions;
		expect(actions).toHaveLength(4);
	});

	it("builds combined header with case/number tags in correct order", () => {
		const cells: NounInflectionCell[] = [
			{ case: "Dative", number: "Plural", article: "den", form: "Kraftwerken" },
			{ case: "Genitive", number: "Plural", article: "der", form: "Kraftwerken" },
		];
		const ctx = makeCtx(cells);
		const result = propagateInflections(ctx);
		const actions = result._unsafeUnwrap().actions;

		const processAction = actions.find(
			(a) => a.kind === VaultActionKind.ProcessMdFile,
		)!;
		const transform = (processAction.payload as { transform: (c: string) => string }).transform;

		const output = transform("");
		// Cases should be in N/A/G/D order → Genitiv before Dativ
		expect(output).toContain("#Genitiv/Dativ/Plural for: [[Kraftwerk]]");
	});
});
