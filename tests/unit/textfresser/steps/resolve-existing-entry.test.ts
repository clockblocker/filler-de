import { describe, expect, it } from "bun:test";
import type { SplitPathToMdFile } from "@textfresser/vault-action-manager";
import { resolveExistingEntry } from "../../../../src/commanders/textfresser/commands/generate/steps/resolve-existing-entry";
import type { CommandStateWithLemma } from "../../../../src/commanders/textfresser/commands/types";
import { dictNoteHelper } from "../../../../src/commanders/textfresser/domain/dict-note";
import type { DictEntry } from "../../../../src/commanders/textfresser/domain/dict-note/types";
import { cssSuffixFor } from "../../../../src/commanders/textfresser/targets/de/sections/section-css-kind";
import {
	DictSectionKind,
	TitleReprFor,
} from "../../../../src/commanders/textfresser/targets/de/sections/section-kind";

const DUMMY_PATH: SplitPathToMdFile = {
	basename: "Arbeit",
	extension: "md",
	kind: "MdFile",
	pathParts: ["Worter", "de", "lexem", "lemma", "a", "arb", "arbei"],
};

function makeCtx(
	content: string,
	disambiguationResult: { matchedIndex: number } | null,
): CommandStateWithLemma {
	return {
		actions: [],
		commandContext: {
			activeFile: {
				content,
				splitPath: DUMMY_PATH,
			},
		},
		resultingActions: [],
		textfresserState: {
			latestLemmaResult: {
				attestation: {
					source: {
						ref: "![[Source#^1|^]]",
						textRaw: "Wir arbeiten zusammen. ^1",
						textWithOnlyTargetMarked: "Wir [arbeiten] zusammen. ^1",
					},
					target: {
						offsetInBlock: 4,
						surface: "arbeiten",
					},
				},
				disambiguationResult,
				lemma: "Arbeit",
				linguisticUnit: "Lexeme",
				posLikeKind: "NOUN",
				surfaceKind: "Lemma",
			},
		},
	} as unknown as CommandStateWithLemma;
}

describe("resolveExistingEntry", () => {
	it("drops matched propagation-only stub and forces full generation", () => {
		const stubEntry: DictEntry = {
			headerContent: "Arbeit",
			id: "LX-LM-NOUN-1",
			meta: {},
			sections: [
				{
					content: "Verwendet in:\n[[Zusammenarbeit]] *(cooperation)* ",
					kind: cssSuffixFor[DictSectionKind.Morphology],
					title: "Morphologische Relationen",
				},
			],
		};
		const content = dictNoteHelper.serialize([stubEntry]).body;

		const result = resolveExistingEntry(makeCtx(content, { matchedIndex: 1 }));
		expect(result.isOk()).toBe(true);
		if (result.isErr()) {
			return;
		}

		expect(result.value.matchedEntry).toBeNull();
		expect(result.value.existingEntries).toHaveLength(0);
		expect(result.value.nextIndex).toBe(1);
	});

	it("keeps real matched entries for re-encounter flow", () => {
		const realEntry: DictEntry = {
			headerContent: "Arbeit",
			id: "LX-LM-NOUN-1",
			meta: {},
			sections: [
				{
					content: "![[Source#^1|^]]",
					kind: cssSuffixFor[DictSectionKind.Attestation],
					title: "Kontexte",
				},
				{
					content: "work",
					kind: cssSuffixFor[DictSectionKind.Translation],
					title: "Übersetzung",
				},
			],
		};
		const content = dictNoteHelper.serialize([realEntry]).body;

		const result = resolveExistingEntry(makeCtx(content, { matchedIndex: 1 }));
		expect(result.isOk()).toBe(true);
		if (result.isErr()) {
			return;
		}

		expect(result.value.matchedEntry?.id).toBe(realEntry.id);
		expect(result.value.existingEntries).toHaveLength(1);
		expect(result.value.nextIndex).toBe(2);
	});

	it("treats null disambiguation as new-entry flow while keeping parsed entries", () => {
		const realEntry: DictEntry = {
			headerContent: "Arbeit",
			id: "LX-LM-NOUN-1",
			meta: {},
			sections: [
				{
					content: "![[Source#^1|^]]",
					kind: cssSuffixFor[DictSectionKind.Attestation],
					title: "Kontexte",
				},
				{
					content: "work",
					kind: cssSuffixFor[DictSectionKind.Translation],
					title: "Übersetzung",
				},
			],
		};
		const content = dictNoteHelper.serialize([realEntry]).body;

		const result = resolveExistingEntry(makeCtx(content, null));
		expect(result.isOk()).toBe(true);
		if (result.isErr()) {
			return;
		}

		expect(result.value.matchedEntry).toBeNull();
		expect(result.value.existingEntries).toHaveLength(1);
		expect(result.value.nextIndex).toBe(2);
	});

	it("does not treat matched entry as propagation-only stub when manual links are present", () => {
		const entryWithManualLinks: DictEntry = {
			headerContent: "Arbeit",
			id: "LX-LM-NOUN-1",
			meta: {},
			sections: [
				{
					content: "≈ [[Zusammenarbeit]]",
					kind: cssSuffixFor[DictSectionKind.Relation],
					title: "Semantische Beziehungen",
				},
				{
					content: "User note: [[Arbeit]] is everywhere.",
					kind: cssSuffixFor[DictSectionKind.FreeForm],
					title: TitleReprFor[DictSectionKind.FreeForm].German,
				},
			],
		};
		const content = dictNoteHelper.serialize([entryWithManualLinks]).body;

		const result = resolveExistingEntry(makeCtx(content, { matchedIndex: 1 }));
		expect(result.isOk()).toBe(true);
		if (result.isErr()) {
			return;
		}

		expect(result.value.matchedEntry?.id).toBe(entryWithManualLinks.id);
		expect(result.value.existingEntries).toHaveLength(1);
		expect(result.value.nextIndex).toBe(2);
	});

	it("still drops a propagation-only stub when raw recognized sections sit nearby", () => {
		const stubWithRawNeighborContent = [
			"Arbeit ^LX-LM-NOUN-1",
			"",
			'<span class="entry_section_title entry_section_title_synonyme">Semantische Beziehungen</span>',
			"≈ [[Zusammenarbeit]]",
			'<span class="entry_section_title entry_section_title_translations">Custom Title</span>',
			"manual translation",
		].join("\n");

		const result = resolveExistingEntry(
			makeCtx(stubWithRawNeighborContent, { matchedIndex: 1 }),
		);
		expect(result.isOk()).toBe(true);
		if (result.isErr()) {
			return;
		}

		expect(result.value.matchedEntry).toBeNull();
		expect(result.value.existingEntries).toHaveLength(0);
		expect(result.value.nextIndex).toBe(1);
	});
});
