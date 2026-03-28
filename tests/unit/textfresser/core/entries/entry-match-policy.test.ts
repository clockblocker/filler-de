import { describe, expect, it } from "bun:test";
import {
	resolveEntryMatch,
	type MatchableEntry,
} from "../../../../../src/commanders/textfresser/core/entries/entry-match-policy";
import { dictNoteHelper } from "../../../../../src/commanders/textfresser/domain/dict-note";
import type { DictEntry } from "../../../../../src/commanders/textfresser/domain/dict-note/types";
import { cssSuffixFor } from "../../../../../src/commanders/textfresser/targets/de/sections/section-css-kind";
import { DictSectionKind } from "../../../../../src/commanders/textfresser/targets/de/sections/section-kind";
import { findSectionSpecByMarker } from "../../../../../src/commanders/textfresser/core/contracts/language-pack";
import { deLanguagePack } from "../../../../../src/commanders/textfresser/languages/de/pack";

function parseMatchableEntries(entries: DictEntry[]): MatchableEntry[] {
	return dictNoteHelper.parseWithLinguisticWikilinks({
		noteText: dictNoteHelper.serialize(entries).body,
	});
}

const stubPolicy = {
	getSectionKey(section: MatchableEntry["sections"][number]) {
		return findSectionSpecByMarker(deLanguagePack, section.kind)?.key;
	},
	propagationOnlyKeys: ["relation", "morphology", "inflection", "tags"] as const,
};

describe("resolveEntryMatch", () => {
	it("matches by unit kind, pos, and index while ignoring surface kind", () => {
		const entries = parseMatchableEntries([
			{
				headerContent: "arbeiten",
				id: "LX-LM-VERB-2",
				meta: {},
				sections: [
					{
						content: "![[Source#^1|^]]",
						kind: cssSuffixFor[DictSectionKind.Attestation],
						title: "Kontexte",
					},
				],
			},
		]);

		const result = resolveEntryMatch({
			disambiguationResult: { matchedIndex: 2 },
			existingEntries: entries,
			linguisticUnit: "Lexem",
			posLikeKind: "Verb",
			stubPolicy,
			surfaceKind: "Inflected",
		});

		expect(result.matchedEntry?.id).toBe("LX-LM-VERB-2");
		expect(result.nextIndex).toBe(1);
	});

	it("drops propagation-only stubs when they only contain generated-link intents", () => {
		const entries = parseMatchableEntries([
			{
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
			},
		]);

		const result = resolveEntryMatch({
			disambiguationResult: { matchedIndex: 1 },
			existingEntries: entries,
			linguisticUnit: "Lexem",
			posLikeKind: "Noun",
			stubPolicy,
			surfaceKind: "Lemma",
		});

		expect(result.matchedEntry).toBeNull();
		expect(result.existingEntries).toHaveLength(0);
		expect(result.nextIndex).toBe(1);
	});

	it("keeps entries with manual-link escape hatches out of stub classification", () => {
		const entries = parseMatchableEntries([
			{
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
						title: "Notizen",
					},
				],
			},
		]);

		const result = resolveEntryMatch({
			disambiguationResult: { matchedIndex: 1 },
			existingEntries: entries,
			linguisticUnit: "Lexem",
			posLikeKind: "Noun",
			stubPolicy,
			surfaceKind: "Lemma",
		});

		expect(result.matchedEntry?.id).toBe("LX-LM-NOUN-1");
		expect(result.existingEntries).toHaveLength(1);
		expect(result.nextIndex).toBe(2);
	});
});
