import { describe, expect, it } from "bun:test";
import type { GenerateSectionsResult } from "../../../../src/commanders/textfresser/commands/generate/steps/generate-sections";
import { propagateMorphologyRelations } from "../../../../src/commanders/textfresser/commands/generate/steps/propagate-morphology-relations";
import type { MorphologyPayload } from "../../../../src/commanders/textfresser/commands/generate/steps/section-generation-types";
import type { MorphemeItem } from "../../../../src/commanders/textfresser/domain/morpheme/morpheme-formatter";
import type { TextfresserState } from "../../../../src/commanders/textfresser/state/textfresser-state";
import { VaultActionKind } from "../../../../src/managers/obsidian/vault-action-manager/types/vault-action";
import type { SplitPathToMdFile } from "../../../../src/managers/obsidian/vault-action-manager/types/split-path";

function makeCtx(params: {
	lemma?: string;
	morphemes?: MorphemeItem[];
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
		morphemes: params.morphemes ?? [],
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
		expect(output).toContain("used_in:");
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

	it("resolves decapitalized constituent path when lookup has lowercase lemma", () => {
		const ctx = makeCtx({
			lemma: "Fahrkarte",
			morphology: {
				compoundedFromLemmas: ["Fahren"],
			},
		});
		const fahrenPath: SplitPathToMdFile = {
			basename: "fahren",
			extension: "md",
			kind: "MdFile",
			pathParts: ["Worter", "de", "lexem", "lemma", "f", "fah", "fahre"],
		};
		(
			ctx.textfresserState as unknown as {
				vam: { findByBasename: (word: string) => SplitPathToMdFile[] };
			}
		).vam = {
			findByBasename: (word: string) =>
				word === "fahren" ? [fahrenPath] : [],
		};

		const result = propagateMorphologyRelations(ctx);
		expect(result.isOk()).toBe(true);
		const actions = result._unsafeUnwrap().actions;
		const upsertAction = actions[0];
		expect(upsertAction?.kind).toBe(VaultActionKind.UpsertMdFile);
		if (!upsertAction || upsertAction.kind !== VaultActionKind.UpsertMdFile) {
			return;
		}
		const payload = upsertAction.payload as { splitPath: SplitPathToMdFile };
		expect(payload.splitPath.basename).toBe("fahren");
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
				"used_in:",
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
		(
			ctx.textfresserState as unknown as {
				vam: { findByBasename: (word: string) => unknown[] };
			}
		).vam = {
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

	it("creates DictEntry equation with decorated header and separability tag (G3)", () => {
		const result = propagateMorphologyRelations(
			makeCtx({
				morphemes: [
					{
						kind: "Prefix",
						linkTarget: "auf-prefix-de",
						separability: "Separable",
						surf: "auf",
					},
					{ kind: "Root", lemma: "passen", surf: "pass" },
				],
				morphology: {
					compoundedFromLemmas: [],
					prefixEquation: {
						baseLemma: "passen",
						prefixDisplay: ">auf",
						prefixTarget: "auf-prefix-de",
						sourceLemma: "aufpassen",
					},
				},
			}),
		);
		expect(result.isOk()).toBe(true);
		const actions = result._unsafeUnwrap().actions;
		const transform = extractTransforms(actions)[0];
		expect(transform).toBeDefined();
		if (!transform) return;

		const output = transform("");
		expect(output).toContain(">auf ^MO-LM-1");
		expect(output).toContain("#prefix/separable");
		expect(output).toContain(
			"[[auf-prefix-de|>auf]] + [[passen]] = [[aufpassen]]",
		);
	});

	it("keeps separable and inseparable entries separate on the same prefix note (G3)", () => {
		const sepResult = propagateMorphologyRelations(
			makeCtx({
				lemma: "übersetzen",
				morphemes: [
					{
						kind: "Prefix",
						linkTarget: "uber-prefix-de",
						separability: "Separable",
						surf: "über",
					},
					{ kind: "Root", lemma: "setzen", surf: "setz" },
				],
				morphology: {
					compoundedFromLemmas: [],
					prefixEquation: {
						baseLemma: "setzen",
						prefixDisplay: ">über",
						prefixTarget: "uber-prefix-de",
						sourceLemma: "übersetzen",
					},
				},
			}),
		);
		const sepTransform = extractTransforms(sepResult._unsafeUnwrap().actions)[0];
		expect(sepTransform).toBeDefined();
		if (!sepTransform) return;
		const afterSep = sepTransform("");

		const insepResult = propagateMorphologyRelations(
			makeCtx({
				lemma: "übertreiben",
				morphemes: [
					{
						kind: "Prefix",
						linkTarget: "uber-prefix-de",
						separability: "Inseparable",
						surf: "über",
					},
					{ kind: "Root", lemma: "treiben", surf: "treib" },
				],
				morphology: {
					compoundedFromLemmas: [],
					prefixEquation: {
						baseLemma: "treiben",
						prefixDisplay: "über<",
						prefixTarget: "uber-prefix-de",
						sourceLemma: "übertreiben",
					},
				},
			}),
		);
		const insepTransform = extractTransforms(insepResult._unsafeUnwrap().actions)[0];
		expect(insepTransform).toBeDefined();
		if (!insepTransform) return;
		const output = insepTransform(afterSep);

		expect(output).toContain(">über");
		expect(output).toContain("über<");
		expect(output).toContain("#prefix/separable");
		expect(output).toContain("#prefix/inseparable");
		expect(output).toContain("^MO-LM-1");
		expect(output).toContain("^MO-LM-2");
	});

	it("appends and deduplicates equation on re-encounter for the same decorated entry", () => {
		const result = propagateMorphologyRelations(
			makeCtx({
				lemma: "aufmachen",
				morphemes: [
					{
						kind: "Prefix",
						linkTarget: "auf-prefix-de",
						separability: "Separable",
						surf: "auf",
					},
					{ kind: "Root", lemma: "machen", surf: "mach" },
				],
				morphology: {
					compoundedFromLemmas: [],
					prefixEquation: {
						baseLemma: "machen",
						prefixDisplay: ">auf",
						prefixTarget: "auf-prefix-de",
						sourceLemma: "aufmachen",
					},
				},
			}),
		);
		const transform = extractTransforms(result._unsafeUnwrap().actions)[0];
		expect(transform).toBeDefined();
		if (!transform) return;

		const existingContent = [
			"",
			">auf ^MO-LM-1",
			"",
			'<span class="entry_section_title entry_section_title_tags">Tags</span>',
			"#prefix/separable",
			'<span class="entry_section_title entry_section_title_morphologie">Morphologische Relationen</span>',
			"[[auf-prefix-de|>auf]] + [[passen]] = [[aufpassen]]",
		].join("\n");

		const first = transform(existingContent);
		const expectedLine = "[[auf-prefix-de|>auf]] + [[machen]] = [[aufmachen]]";
		expect(first).toContain("[[auf-prefix-de|>auf]] + [[passen]] = [[aufpassen]]");
		expect(first).toContain(expectedLine);

		const second = transform(first);
		const matches = second.match(
			/\[\[auf-prefix-de\|>auf\]\] \+ \[\[machen\]\] = \[\[aufmachen\]\]/g,
		);
		expect(matches?.length).toBe(1);
	});

	it("uses fallback append path for non-dict prefix notes (G2)", () => {
		const result = propagateMorphologyRelations(
			makeCtx({
				morphemes: [
					{
						kind: "Prefix",
						linkTarget: "auf-prefix-de",
						separability: "Separable",
						surf: "auf",
					},
					{ kind: "Root", lemma: "passen", surf: "pass" },
				],
				morphology: {
					compoundedFromLemmas: [],
					prefixEquation: {
						baseLemma: "passen",
						prefixDisplay: ">auf",
						prefixTarget: "auf-prefix-de",
						sourceLemma: "aufpassen",
					},
				},
			}),
		);

		const transform = extractTransforms(result._unsafeUnwrap().actions)[0];
		expect(transform).toBeDefined();
		if (!transform) return;

		const existing = "Meine freie Notiz ueber auf- Prefixe.";
		const output = transform(existing);
		expect(output).toContain(existing);
		expect(output).toContain("entry_section_title_morphologie");
		expect(output).toContain(
			"[[auf-prefix-de|>auf]] + [[passen]] = [[aufpassen]]",
		);
		expect(output).not.toContain("^MO-LM-");
		expect(output).not.toContain("#prefix/");
	});

	it("resolves equation targets to Library prefix path", () => {
		const result = propagateMorphologyRelations(
			makeCtx({
				morphemes: [
					{
						kind: "Prefix",
						linkTarget: "auf-prefix-de",
						separability: "Separable",
						surf: "auf",
					},
					{ kind: "Root", lemma: "passen", surf: "pass" },
				],
				morphology: {
					compoundedFromLemmas: [],
					prefixEquation: {
						baseLemma: "passen",
						prefixDisplay: ">auf",
						prefixTarget: "auf-prefix-de",
						sourceLemma: "aufpassen",
					},
				},
			}),
		);
		expect(result.isOk()).toBe(true);

		const actions = result._unsafeUnwrap().actions;
		expect(actions[0]?.kind).toBe(VaultActionKind.UpsertMdFile);
		const upsertPayload = actions[0]?.payload as
			| { splitPath: { pathParts: string[] } }
			| undefined;
		expect(upsertPayload?.splitPath.pathParts).toEqual([
			"Library",
			"de",
			"prefix",
		]);
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
