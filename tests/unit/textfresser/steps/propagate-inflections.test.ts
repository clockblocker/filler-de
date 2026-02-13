import { describe, expect, it } from "bun:test";
import type { GenerateSectionsResult } from "../../../../src/commanders/textfresser/commands/generate/steps/generate-sections";
import { propagateInflections } from "../../../../src/commanders/textfresser/commands/generate/steps/propagate-inflections";
import type { TextfresserState } from "../../../../src/commanders/textfresser/textfresser";
import type { NounInflectionCell } from "../../../../src/linguistics/de/lexem/noun";
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
			lookupInLibrary: () => [],
			vam: { findByBasename: () => [] },
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

	it("skips cells when form equals lemma (no actions, allEntries unchanged)", () => {
		const cells: NounInflectionCell[] = [
			{ article: "das", case: "Nominative", form: "Kraftwerk", number: "Singular" },
			{ article: "das", case: "Accusative", form: "Kraftwerk", number: "Singular" },
		];
		const ctx = makeCtx(cells);
		const result = propagateInflections(ctx);
		expect(result.isOk()).toBe(true);

		expect(result._unsafeUnwrap().actions).toHaveLength(0);
		expect(result._unsafeUnwrap().allEntries).toEqual(ctx.allEntries);
	});

	it("groups multiple cells by form word and produces per-cell entries", () => {
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

		// Verify "Kraftwerke" transform produces 3 separate entries (Nom, Akk, Gen)
		const processKraftwerke = actions.find(
			(a) => a.kind === VaultActionKind.ProcessMdFile
				&& (a.payload as { splitPath: { basename: string } }).splitPath.basename === "Kraftwerke",
		);
		expect(processKraftwerke).toBeDefined();
		const transformKraftwerke = (processKraftwerke!.payload as { transform: (c: string) => string }).transform;
		const outputKraftwerke = transformKraftwerke("");
		expect(outputKraftwerke).toContain("#Nominativ/Plural for: [[Kraftwerk]]");
		expect(outputKraftwerke).toContain("#Akkusativ/Plural for: [[Kraftwerk]]");
		expect(outputKraftwerke).toContain("#Genitiv/Plural for: [[Kraftwerk]]");
	});

	it("uses existing path from VAM when file already exists", () => {
		const existingPath = {
			basename: "Kraftwerke",
			extension: "md" as const,
			kind: "MdFile" as const,
			pathParts: ["Worter", "de", "lexem", "inflected", "k", "kra", "kraft"],
		};
		const cells: NounInflectionCell[] = [
			{ article: "die", case: "Nominative", form: "Kraftwerke", number: "Plural" },
		];
		const ctx = makeCtx(cells);
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		(ctx.textfresserState as any).vam = {
			findByBasename: (name: string) => name === "Kraftwerke" ? [existingPath] : [],
		};

		const result = propagateInflections(ctx);
		expect(result.isOk()).toBe(true);

		const actions = result._unsafeUnwrap().actions;
		// UpsertMdFile + ProcessMdFile (no healing since inflected→inflected)
		expect(actions).toHaveLength(2);
		const upsertPayload = actions[0]!.payload as { splitPath: typeof existingPath };
		expect(upsertPayload.splitPath).toBe(existingPath);
	});

	it("builds per-cell headers (one per case/number combo, not combined)", () => {
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
		// Each cell gets its own header
		expect(output).toContain("#Dativ/Plural for: [[Kraftwerk]]");
		expect(output).toContain("#Genitiv/Plural for: [[Kraftwerk]]");
		// No combined header
		expect(output).not.toContain("#Genitiv/Dativ/Plural");
	});

	it("deduplicates identical cell headers", () => {
		const cells: NounInflectionCell[] = [
			{ article: "die", case: "Nominative", form: "Kraftwerke", number: "Plural" },
			{ article: "die", case: "Nominative", form: "Kraftwerke", number: "Plural" },
		];
		const ctx = makeCtx(cells);
		const result = propagateInflections(ctx);
		expect(result.isOk()).toBe(true);

		const actions = result._unsafeUnwrap().actions;
		const processAction = actions.find(
			(a) => a.kind === VaultActionKind.ProcessMdFile,
		)!;
		const transform = (processAction.payload as { transform: (c: string) => string }).transform;

		const output = transform("");
		// Should only appear once despite two identical cells
		const matches = output.match(/#Nominativ\/Plural for: \[\[Kraftwerk\]\]/g);
		expect(matches).toHaveLength(1);
	});
});
