import { describe, expect, it } from "bun:test";
import type { GenerateSectionsResult } from "../../../../src/commanders/textfresser/commands/generate/steps/generate-sections";
import { propagateMorphologyRelations } from "../../../../src/commanders/textfresser/commands/generate/steps/propagate-morphology-relations";
import type { MorphologyPayload } from "../../../../src/commanders/textfresser/commands/generate/steps/section-generation-types";
import type { TextfresserState } from "../../../../src/commanders/textfresser/state/textfresser-state";
import { VaultActionKind } from "../../../../src/managers/obsidian/vault-action-manager/types/vault-action";

function makeCtx(params: {
	lemma?: string;
	morphology?: MorphologyPayload;
	sourceTranslation?: string;
}): GenerateSectionsResult {
	const lemma = params.lemma ?? "aufpassen";
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
		morphemes: [],
		nextIndex: 1,
		relations: [],
		resultingActions: [],
		sourceTranslation: params.sourceTranslation,
		textfresserState: {
			languages: { known: "English", target: "German" },
			latestLemmaResult: {
				attestation: { source: { ref: "![[Src#^1|^]]" } },
				disambiguationResult: null,
				lemma,
				linguisticUnit: "Lexem",
				posLikeKind: "Verb",
				surfaceKind: "Lemma",
			},
			lookupInLibrary: () => [],
			vam: { findByBasename: () => [] },
		} as unknown as TextfresserState,
		...(params.morphology ? { morphology: params.morphology } : {}),
	} as unknown as GenerateSectionsResult;
}

function extractTransforms(
	actions: GenerateSectionsResult["actions"],
): Array<(content: string) => string> {
	return actions
		.filter((action) => action.kind === VaultActionKind.ProcessMdFile)
		.map(
			(action) =>
				(
					action.payload as {
						transform: (content: string) => string;
					}
				).transform,
		);
}

describe("propagateMorphologyRelations", () => {
	it("no-ops when no morphology payload is available", () => {
		const result = propagateMorphologyRelations(makeCtx({}));
		expect(result.isOk()).toBe(true);
		expect(result._unsafeUnwrap().actions).toHaveLength(0);
	});

	it("propagates derived backlink with translation gloss", () => {
		const result = propagateMorphologyRelations(
			makeCtx({
				morphology: {
					compoundedFromLemmas: [],
					derivedFromLemma: "passen",
				},
				sourceTranslation: "to watch out",
			}),
		);
		expect(result.isOk()).toBe(true);

		const actions = result._unsafeUnwrap().actions;
		expect(actions).toHaveLength(2);
		expect(actions[0]?.kind).toBe(VaultActionKind.UpsertMdFile);
		expect(actions[1]?.kind).toBe(VaultActionKind.ProcessMdFile);

		const transform = extractTransforms(actions)[0];
		expect(transform).toBeDefined();
		if (!transform) return;
		const output = transform("");
		expect(output).toContain("<used_in>");
		expect(output).toContain("[[aufpassen]] *(to watch out)*");
	});

	it("propagates compounds to each constituent target", () => {
		const result = propagateMorphologyRelations(
			makeCtx({
				lemma: "Küchenfenster",
				morphology: {
					compoundedFromLemmas: ["Küche", "Fenster"],
				},
				sourceTranslation: "kitchen window",
			}),
		);
		expect(result.isOk()).toBe(true);
		const actions = result._unsafeUnwrap().actions;
		expect(actions).toHaveLength(4);
		expect(actions[0]?.kind).toBe(VaultActionKind.UpsertMdFile);
		expect(actions[1]?.kind).toBe(VaultActionKind.ProcessMdFile);
		expect(actions[2]?.kind).toBe(VaultActionKind.UpsertMdFile);
		expect(actions[3]?.kind).toBe(VaultActionKind.ProcessMdFile);
	});

	it("deduplicates exact backlinks and appends at block end", () => {
		const result = propagateMorphologyRelations(
			makeCtx({
				morphology: {
					compoundedFromLemmas: [],
					derivedFromLemma: "passen",
				},
			}),
		);
		const actions = result._unsafeUnwrap().actions;
		const transform = extractTransforms(actions)[0];
		expect(transform).toBeDefined();
		if (!transform) return;

		const first = transform(
			[
				'<span class="entry_section_title entry_section_title_morphologie">Morphologische Relationen</span>',
				"<used_in>",
				"[[alt]]",
			].join("\n"),
		);
		expect(first).toContain("[[alt]]");
		expect(first).toContain("[[aufpassen]]");

		const second = transform(first);
		const matches = second.match(/\[\[aufpassen\]\]/g);
		expect(matches?.length).toBe(1);
	});

	it("applies healing when target is found under inflected path", () => {
		const ctx = makeCtx({
			morphology: {
				compoundedFromLemmas: [],
				derivedFromLemma: "Anlage",
			},
		});
		const inflectedPath = {
			basename: "Anlage",
			extension: "md" as const,
			kind: "MdFile" as const,
			pathParts: ["Worter", "de", "lexem", "inflected", "a", "anl", "anlag"],
		};
		(ctx.textfresserState as unknown as { vam: { findByBasename: (word: string) => unknown[] } }).vam =
			{
				findByBasename: (word: string) =>
					word === "Anlage" ? [inflectedPath] : [],
			};

		const result = propagateMorphologyRelations(ctx);
		expect(result.isOk()).toBe(true);
		const actions = result._unsafeUnwrap().actions;
		expect(actions).toHaveLength(3);
		expect(actions[0]?.kind).toBe(VaultActionKind.RenameMdFile);
		expect(actions[1]?.kind).toBe(VaultActionKind.UpsertMdFile);
		expect(actions[2]?.kind).toBe(VaultActionKind.ProcessMdFile);
	});

	it("falls back to no gloss when translation is missing", () => {
		const result = propagateMorphologyRelations(
			makeCtx({
				morphology: {
					compoundedFromLemmas: [],
					derivedFromLemma: "passen",
				},
			}),
		);
		const actions = result._unsafeUnwrap().actions;
		const transform = extractTransforms(actions)[0];
		expect(transform).toBeDefined();
		if (!transform) return;
		const output = transform("");
		expect(output).toContain("[[aufpassen]]");
		expect(output).not.toContain("*(");
	});

	it("does not create prefix equation from derived_from alone", () => {
		const result = propagateMorphologyRelations(
			makeCtx({
				morphology: {
					compoundedFromLemmas: [],
					derivedFromLemma: "passen",
				},
			}),
		);
		const actions = result._unsafeUnwrap().actions;
		const outputs = extractTransforms(actions).map((transform) => transform(""));
		expect(outputs.some((output) => output.includes("]] = [["))).toBe(false);
	});
});
