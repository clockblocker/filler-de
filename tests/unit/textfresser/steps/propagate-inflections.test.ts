import { describe, expect, it } from "bun:test";
import type { GenerateSectionsResult } from "../../../../src/commanders/textfresser/commands/generate/steps/generate-sections";
import { propagateInflections } from "../../../../src/commanders/textfresser/commands/generate/steps/propagate-inflections";
import type { TextfresserState } from "../../../../src/commanders/textfresser/textfresser";
import type { NounInflectionCell } from "../../../../src/linguistics/de/lexem/noun";
import { VaultActionKind } from "../../../../src/managers/obsidian/vault-action-manager/types/vault-action";
import { dictNoteHelper } from "../../../../src/commanders/textfresser/domain/dict-note";
import type { DictEntry } from "../../../../src/commanders/textfresser/domain/dict-note/types";

function makeCtx(
	inflectionCells: NounInflectionCell[],
	lemma = "Kraftwerk",
	options: {
		nounInflectionGenus?: GenerateSectionsResult["nounInflectionGenus"];
		targetLanguage?: GenerateSectionsResult["textfresserState"]["languages"]["target"];
	} = {},
): GenerateSectionsResult {
	const targetLanguage = options.targetLanguage ?? "German";
	const hasNounGenusOverride = Object.prototype.hasOwnProperty.call(
		options,
		"nounInflectionGenus",
	);

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
		nounInflectionGenus: hasNounGenusOverride
			? options.nounInflectionGenus
			: "Maskulinum",
		relations: [],
		resultingActions: [],
		textfresserState: {
			languages: { known: "English", target: targetLanguage },
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

function getProcessTransform(
	ctx: GenerateSectionsResult,
	basename?: string,
): ((content: string) => string) | null {
	const result = propagateInflections(ctx);
	if (result.isErr()) return null;

	const processAction = result
		._unsafeUnwrap()
		.actions.find(
			(action) =>
				action.kind === VaultActionKind.ProcessMdFile &&
				(basename
					? (action.payload as { splitPath: { basename: string } })
							.splitPath.basename === basename
					: true),
		);
	if (!processAction) return null;
	return (processAction.payload as { transform: (content: string) => string })
		.transform;
}

function getTagsContent(entry: DictEntry): string | undefined {
	const tagsSection = entry.sections.find((section) => section.kind === "tags");
	return tagsSection?.content;
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
			{
				article: "die",
				case: "Nominative",
				form: "Kraftwerke",
				number: "Plural",
			},
		];
		const ctx = makeCtx(cells);
		const result = propagateInflections(ctx);
		expect(result.isOk()).toBe(true);

		const actions = result._unsafeUnwrap().actions;
		expect(actions).toHaveLength(2);
		const firstAction = actions[0];
		const secondAction = actions[1];
		expect(firstAction?.kind).toBe(VaultActionKind.UpsertMdFile);
		expect(secondAction?.kind).toBe(VaultActionKind.ProcessMdFile);
	});

	it("skips cells when form equals lemma (no actions, allEntries unchanged)", () => {
		const cells: NounInflectionCell[] = [
			{
				article: "das",
				case: "Nominative",
				form: "Kraftwerk",
				number: "Singular",
			},
			{
				article: "das",
				case: "Accusative",
				form: "Kraftwerk",
				number: "Singular",
			},
		];
		const ctx = makeCtx(cells);
		const result = propagateInflections(ctx);
		expect(result.isOk()).toBe(true);

		expect(result._unsafeUnwrap().actions).toHaveLength(0);
		expect(result._unsafeUnwrap().allEntries).toEqual(ctx.allEntries);
	});

	it("groups multiple cells by form word and writes one inflection entry with merged tags", () => {
		const cells: NounInflectionCell[] = [
			{
				article: "die",
				case: "Nominative",
				form: "Kraftwerke",
				number: "Plural",
			},
			{
				article: "die",
				case: "Accusative",
				form: "Kraftwerke",
				number: "Plural",
			},
			{
				article: "der",
				case: "Genitive",
				form: "Kraftwerke",
				number: "Plural",
			},
			{
				article: "den",
				case: "Dative",
				form: "Kraftwerken",
				number: "Plural",
			},
		];
		const ctx = makeCtx(cells);
		const result = propagateInflections(ctx);
		expect(result.isOk()).toBe(true);

		// 2 distinct forms: "Kraftwerke" and "Kraftwerken" → 2 × (Upsert + Process) = 4 actions
		const actions = result._unsafeUnwrap().actions;
		expect(actions).toHaveLength(4);

		const transformKraftwerke = getProcessTransform(ctx, "Kraftwerke");
		expect(transformKraftwerke).toBeDefined();
		if (!transformKraftwerke) return;

		const outputKraftwerke = transformKraftwerke("");
		const parsedEntries = dictNoteHelper.parse(outputKraftwerke);
		expect(parsedEntries).toHaveLength(1);

		const entry = parsedEntries[0];
		expect(entry?.headerContent).toBe(
			"#Inflection/Noun/Maskulin for: [[Kraftwerk]]",
		);
		if (entry) {
			expect(getTagsContent(entry)).toBe(
				"#Nominativ/Plural #Akkusativ/Plural #Genitiv/Plural",
			);
		}
	});

	it("uses existing path from VAM when file already exists", () => {
		const existingPath = {
			basename: "Kraftwerke",
			extension: "md" as const,
			kind: "MdFile" as const,
			pathParts: ["Worter", "de", "lexem", "inflected", "k", "kra", "kraft"],
		};
		const cells: NounInflectionCell[] = [
			{
				article: "die",
				case: "Nominative",
				form: "Kraftwerke",
				number: "Plural",
			},
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
		const firstAction = actions[0];
		if (firstAction) {
			const upsertPayload = firstAction.payload as {
				splitPath: typeof existingPath;
			};
			expect(upsertPayload.splitPath).toBe(existingPath);
		}
	});

	it("deduplicates identical tags for a form", () => {
		const cells: NounInflectionCell[] = [
			{
				article: "die",
				case: "Nominative",
				form: "Kraftwerke",
				number: "Plural",
			},
			{
				article: "die",
				case: "Nominative",
				form: "Kraftwerke",
				number: "Plural",
			},
		];
		const ctx = makeCtx(cells);
		const transform = getProcessTransform(ctx);
		expect(transform).toBeDefined();
		if (!transform) return;

		const output = transform("");
		const entries = dictNoteHelper.parse(output);
		expect(entries).toHaveLength(1);
		const firstEntry = entries[0];
		if (firstEntry) {
			expect(getTagsContent(firstEntry)).toBe("#Nominativ/Plural");
		}
	});

	it("merges tags into existing new-format entry", () => {
		const cells: NounInflectionCell[] = [
			{
				article: "die",
				case: "Nominative",
				form: "Kraftwerke",
				number: "Plural",
			},
			{
				article: "der",
				case: "Genitive",
				form: "Kraftwerke",
				number: "Plural",
			},
		];
		const ctx = makeCtx(cells);
		const transform = getProcessTransform(ctx, "Kraftwerke");
		expect(transform).toBeDefined();
		if (!transform) return;

		const existing: DictEntry[] = [
			{
				headerContent: "#Inflection/Noun/Maskulin for: [[Kraftwerk]]",
				id: "LX-IN-NOUN-1",
				meta: {},
				sections: [{ content: "#Nominativ/Plural", kind: "tags", title: "Tags" }],
			},
		];
		const { body } = dictNoteHelper.serialize(existing);
		const output = transform(body);
		const entries = dictNoteHelper.parse(output);

		expect(entries).toHaveLength(1);
		const firstEntry = entries[0];
		if (firstEntry) {
			expect(getTagsContent(firstEntry)).toBe(
				"#Nominativ/Plural #Genitiv/Plural",
			);
		}
	});

	it("auto-collapses legacy per-cell entries into new format entry", () => {
		const cells: NounInflectionCell[] = [
			{
				article: "die",
				case: "Nominative",
				form: "Kraftwerke",
				number: "Plural",
			},
		];
		const ctx = makeCtx(cells);
		const transform = getProcessTransform(ctx, "Kraftwerke");
		expect(transform).toBeDefined();
		if (!transform) return;

		const legacyEntries: DictEntry[] = [
			{
				headerContent: "#Nominativ/Plural for: [[Kraftwerk]]",
				id: "LX-IN-NOUN-1",
				meta: {},
				sections: [],
			},
			{
				headerContent: "#Akkusativ/Plural for: [[Kraftwerk]]",
				id: "LX-IN-NOUN-2",
				meta: {},
				sections: [],
			},
		];
		const { body } = dictNoteHelper.serialize(legacyEntries);
		const output = transform(body);
		const entries = dictNoteHelper.parse(output);

		expect(entries).toHaveLength(1);
		expect(entries[0]?.headerContent).toBe(
			"#Inflection/Noun/Maskulin for: [[Kraftwerk]]",
		);
		const firstEntry = entries[0];
		if (firstEntry) {
			expect(getTagsContent(firstEntry)).toBe(
				"#Nominativ/Plural #Akkusativ/Plural",
			);
		}
	});

	it("propagates with fallback header when noun genus is unresolved", () => {
		const cells: NounInflectionCell[] = [
			{
				article: "die",
				case: "Nominative",
				form: "Kraftwerke",
				number: "Plural",
			},
		];
		const ctx = makeCtx(cells, "Kraftwerk", {
			nounInflectionGenus: undefined,
		});
		const result = propagateInflections(ctx);

		expect(result.isOk()).toBe(true);
		expect(result._unsafeUnwrap().actions).toHaveLength(2);

		const transform = getProcessTransform(ctx, "Kraftwerke");
		expect(transform).toBeDefined();
		if (!transform) return;

		const output = transform("");
		const entries = dictNoteHelper.parse(output);

		expect(entries).toHaveLength(1);
		expect(entries[0]?.headerContent).toBe(
			"#Inflection/Noun for: [[Kraftwerk]]",
		);
	});

	it("upgrades fallback header to genus header when genus becomes available", () => {
		const cells: NounInflectionCell[] = [
			{
				article: "die",
				case: "Nominative",
				form: "Kraftwerke",
				number: "Plural",
			},
		];
		const withoutGenusCtx = makeCtx(cells, "Kraftwerk", {
			nounInflectionGenus: undefined,
		});
		const withGenusCtx = makeCtx(cells, "Kraftwerk", {
			nounInflectionGenus: "Maskulinum",
		});

		const createFallbackTransform = getProcessTransform(
			withoutGenusCtx,
			"Kraftwerke",
		);
		expect(createFallbackTransform).toBeDefined();
		if (!createFallbackTransform) return;

		const fallbackOutput = createFallbackTransform("");
		const upgradeTransform = getProcessTransform(withGenusCtx, "Kraftwerke");
		expect(upgradeTransform).toBeDefined();
		if (!upgradeTransform) return;

		const upgradedOutput = upgradeTransform(fallbackOutput);
		const entries = dictNoteHelper.parse(upgradedOutput);
		expect(entries).toHaveLength(1);
		expect(entries[0]?.headerContent).toBe(
			"#Inflection/Noun/Maskulin for: [[Kraftwerk]]",
		);
	});
});
