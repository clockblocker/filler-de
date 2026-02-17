import { describe, expect, it } from "bun:test";
import type { GenerateSectionsResult } from "../../../../src/commanders/textfresser/commands/generate/steps/generate-sections";
import { propagateMorphemes } from "../../../../src/commanders/textfresser/commands/generate/steps/propagate-morphemes";
import type { MorphologyPayload } from "../../../../src/commanders/textfresser/commands/generate/steps/section-generation-types";
import type { MorphemeItem } from "../../../../src/commanders/textfresser/domain/morpheme/morpheme-formatter";
import type { TextfresserState } from "../../../../src/commanders/textfresser/state/textfresser-state";
import { VaultActionKind } from "../../../../src/managers/obsidian/vault-action-manager/types/vault-action";

function makeCtx(params: {
	lemma?: string;
	morphemes: MorphemeItem[];
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
		morphemes: params.morphemes,
		nextIndex: 1,
		relations: [],
		resultingActions: [],
		sourceTranslation: params.sourceTranslation,
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
		...(params.morphology ? { morphology: params.morphology } : {}),
	} as unknown as GenerateSectionsResult;
}

function extractProcessTransforms(
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

describe("propagateMorphemes", () => {
	it("returns ok with no extra actions for single-morpheme words", () => {
		const result = propagateMorphemes(
			makeCtx({ morphemes: [{ kind: "Root", surf: "Hand" }] }),
		);
		expect(result.isOk()).toBe(true);
		expect(result._unsafeUnwrap().actions).toHaveLength(0);
	});

	it("skips Root/Suffixoid when morphology payload already covers them (G1)", () => {
		const result = propagateMorphemes(
			makeCtx({
				lemma: "Sonderwerkbar",
				morphemes: [
					{ kind: "Root", lemma: "Sonder", surf: "sonder" },
					{
						kind: "Suffixoid",
						linkTarget: "Werk",
						surf: "werk",
					},
					{ kind: "Suffix", surf: "bar" },
				],
				morphology: {
					compoundedFromLemmas: ["Werk"],
					prefixEquation: {
						baseLemma: "Sonder",
						prefixDisplay: ">x",
						prefixTarget: "x",
						sourceLemma: "Sonderwerkbar",
					},
				},
			}),
		);
		expect(result.isOk()).toBe(true);
		const actions = result._unsafeUnwrap().actions;
		// Only suffix survives propagation -> 1 x (Upsert + Process)
		expect(actions).toHaveLength(2);
	});

	it("keeps Root fallback propagation when morphology payload does not cover it (G1)", () => {
		const result = propagateMorphemes(
			makeCtx({
				lemma: "obskurlich",
				morphemes: [
					{ kind: "Root", lemma: "obskur", surf: "obskur" },
					{ kind: "Suffix", surf: "lich" },
				],
				morphology: {
					compoundedFromLemmas: ["anders"],
					derivedFromLemma: "anders",
				},
			}),
		);
		expect(result.isOk()).toBe(true);
		const actions = result._unsafeUnwrap().actions;
		expect(actions).toHaveLength(4);

		const rootTransform = extractProcessTransforms(actions)[0];
		expect(rootTransform).toBeDefined();
		if (!rootTransform) return;
		const output = rootTransform("");
		expect(output).toContain("obskur");
		expect(output).toContain("<used_in>");
		expect(output).toContain("[[obskurlich]]");
	});

	it("always skips verb prefixes with separability", () => {
		const result = propagateMorphemes(
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
			}),
		);
		expect(result.isOk()).toBe(true);
		const actions = result._unsafeUnwrap().actions;
		// Prefix skipped, root propagated
		expect(actions).toHaveLength(2);
	});

	it("keeps non-verb prefix propagation", () => {
		const result = propagateMorphemes(
			makeCtx({
				lemma: "unklar",
				morphemes: [
					{ kind: "Prefix", surf: "un" },
					{ kind: "Root", lemma: "klar", surf: "klar" },
				],
				morphology: {
					compoundedFromLemmas: [],
					derivedFromLemma: "klar",
				},
			}),
		);
		expect(result.isOk()).toBe(true);
		const actions = result._unsafeUnwrap().actions;
		// Root is covered by morphology, prefix remains
		expect(actions).toHaveLength(2);

		const transform = extractProcessTransforms(actions)[0];
		expect(transform).toBeDefined();
		if (!transform) return;
		const output = transform("");
		expect(output).toContain("un");
		expect(output).toContain("#prefix");
		expect(output).not.toContain("#prefix/separable");
	});

	it("creates Header + Tags + Morphology(<used_in>) for new entry", () => {
		const result = propagateMorphemes(
			makeCtx({
				lemma: "Freiheit",
				morphemes: [
					{ kind: "Suffix", surf: "heit" },
					{ kind: "Root", lemma: "frei", surf: "frei" },
				],
				sourceTranslation: "freedom\nline two",
			}),
		);
		const actions = result._unsafeUnwrap().actions;
		const transform = extractProcessTransforms(actions)[0];
		expect(transform).toBeDefined();
		if (!transform) return;
		const output = transform("");

		expect(output).toContain("heit");
		expect(output).toContain("#suffix");
		expect(output).toContain("Morphologische Relationen");
		expect(output).toContain("<used_in>");
		expect(output).toContain("[[Freiheit]] *(freedom)*");
		expect(output).not.toContain("Kontexte");
		expect(output).toMatch(/\^MO-LM-\d+/);
	});

	it("re-encounter appends and deduplicates in <used_in> block", () => {
		const result = propagateMorphemes(
			makeCtx({
				lemma: "Traurigkeit",
				morphemes: [
					{ kind: "Suffix", surf: "keit" },
					{ kind: "Root", lemma: "traurig", surf: "traurig" },
				],
				sourceTranslation: "sadness",
			}),
		);
		const actions = result._unsafeUnwrap().actions;
		const transform = extractProcessTransforms(actions)[0];
		expect(transform).toBeDefined();
		if (!transform) return;

		const existingContent = [
			"",
			"keit ^MO-LM-1",
			"",
			'<span class="entry_section_title entry_section_title_tags">Tags</span>',
			"#suffix",
			'<span class="entry_section_title entry_section_title_morphologie">Morphologische Relationen</span>',
			"<used_in>",
			"[[Eitelkeit]]",
		].join("\n");

		const first = transform(existingContent);
		expect(first).toContain("[[Eitelkeit]]");
		expect(first).toContain("[[Traurigkeit]] *(sadness)*");

		const second = transform(first);
		expect(second).toBe(first);
	});

	it("skips self-ref morphemes", () => {
		const result = propagateMorphemes(
			makeCtx({
				lemma: "unklar",
				morphemes: [
					{ kind: "Prefix", surf: "un" },
					{ kind: "Root", lemma: "unklar", surf: "klar" },
				],
			}),
		);
		expect(result.isOk()).toBe(true);
		const actions = result._unsafeUnwrap().actions;
		// Prefix only, self-ref root skipped
		expect(actions).toHaveLength(2);
	});
});
