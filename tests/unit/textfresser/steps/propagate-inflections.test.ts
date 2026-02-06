import { describe, expect, it } from "bun:test";
import type { GenerateSectionsResult } from "../../../../src/commanders/textfresser/commands/generate/steps/generate-sections";
import { propagateInflections } from "../../../../src/commanders/textfresser/commands/generate/steps/propagate-inflections";
import type { TextfresserState } from "../../../../src/commanders/textfresser/textfresser";
import type { NounInflectionCell } from "../../../../src/linguistics/german/inflection/noun";
import { VaultActionKind } from "../../../../src/managers/obsidian/vault-action-manager/types/vault-action";

function makeCtx(
	inflectionCells: NounInflectionCell[],
	lemma = "Kraftwerk",
): GenerateSectionsResult {
	return {
		actions: [],
		allEntries: [
			{
				headerContent: `[[${lemma}]]`,
				id: "LX-LM-NOUN-1",
				meta: {},
				sections: [],
			},
		],
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
		inflectionCells,
		matchedEntry: null,
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
				pos: "Noun",
				surfaceKind: "Lemma",
			},
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
			{ article: "die", case: "Nominative", form: "Kraftwerke", number: "Plural" },
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
			{ article: "das", case: "Nominative", form: "Kraftwerk", number: "Singular" },
			{ article: "das", case: "Accusative", form: "Kraftwerk", number: "Singular" },
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
			{ article: "die", case: "Nominative", form: "Kraftwerke", number: "Plural" },
			{ article: "die", case: "Accusative", form: "Kraftwerke", number: "Plural" },
			{ article: "der", case: "Genitive", form: "Kraftwerke", number: "Plural" },
			{ article: "den", case: "Dative", form: "Kraftwerken", number: "Plural" },
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
			{ article: "den", case: "Dative", form: "Kraftwerken", number: "Plural" },
			{ article: "der", case: "Genitive", form: "Kraftwerken", number: "Plural" },
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
