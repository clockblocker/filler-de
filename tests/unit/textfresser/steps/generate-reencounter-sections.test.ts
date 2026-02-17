import { describe, expect, it } from "bun:test";
import { okAsync, type ResultAsync } from "neverthrow";
import { generateSections } from "../../../../src/commanders/textfresser/commands/generate/steps/generate-sections";
import type { ResolvedEntryState } from "../../../../src/commanders/textfresser/commands/generate/steps/resolve-existing-entry";
import type {
	DictEntry,
	EntrySection,
} from "../../../../src/commanders/textfresser/domain/dict-note/types";
import type { TextfresserState } from "../../../../src/commanders/textfresser/state/textfresser-state";

const PHRASEM_ENTRY_ID = "PH-LM-1";
const NOUN_ENTRY_ID = "LX-LM-NOUN-1";

function section(kind: string, content: string): EntrySection {
	return { content, kind, title: kind };
}

function makePhrasemCtx(params: {
	matchedEntry: DictEntry;
	promptGenerate: (kind: string) => ResultAsync<unknown, unknown>;
}): ResolvedEntryState {
	return {
		actions: [],
		commandContext: {
			activeFile: {
				content: "",
				splitPath: {
					basename: "idiom",
					extension: "md",
					kind: "MdFile",
					pathParts: ["Worter"],
				},
			},
		},
		existingEntries: [params.matchedEntry],
		matchedEntry: params.matchedEntry,
		nextIndex: 2,
		resultingActions: [],
		textfresserState: {
			inFlightGenerate: null,
			languages: { known: "English", target: "German" },
			latestFailedSections: [],
			latestLemmaInvocationCache: null,
			latestLemmaResult: {
				attestation: {
					source: {
						ref: "![[Src#^1|^]]",
						textRaw: "context",
						textWithOnlyTargetMarked: "context [redensart]",
					},
					target: { surface: "redensart" },
				},
				disambiguationResult: { matchedIndex: 1 },
				lemma: "redensart",
				linguisticUnit: "Phrasem",
				posLikeKind: "Idiom",
				surfaceKind: "Lemma",
			},
			lookupInLibrary: () => [],
			promptRunner: {
				generate: (kind: string) => params.promptGenerate(kind),
			},
			vam: {},
		} as unknown as TextfresserState,
	} as unknown as ResolvedEntryState;
}

describe("generateSections re-encounter behavior", () => {
	it("keeps fast path for complete re-encounter entries (append attestation only)", async () => {
		const promptCalls: string[] = [];
		const matchedEntry: DictEntry = {
			headerContent: "Entry",
			id: PHRASEM_ENTRY_ID,
			meta: {},
			sections: [
				section("kontexte", "![[Other#^2|^]]"),
				section("synonyme", "= [[nah]]"),
				section("translations", "idiom"),
			],
		};
		const ctx = makePhrasemCtx({
			matchedEntry,
			promptGenerate: (kind) => {
				promptCalls.push(kind);
				return okAsync("unused");
			},
		});

		const result = await generateSections(ctx);
		expect(result.isOk()).toBe(true);
		expect(promptCalls).toHaveLength(0);

		const attestationSection = matchedEntry.sections.find(
			(s) => s.kind === "kontexte",
		);
		expect(attestationSection?.content).toContain("![[Other#^2|^]]");
		expect(attestationSection?.content).toContain("![[Src#^1|^]]");
	});

	it("regenerates and merges missing V3 sections on re-encounter", async () => {
		const promptCalls: string[] = [];
		const matchedEntry: DictEntry = {
			headerContent: "Entry",
			id: PHRASEM_ENTRY_ID,
			meta: {},
			sections: [
				section("kontexte", "![[Other#^2|^]]"),
				section("synonyme", "= [[nah]]"),
			],
		};
		const ctx = makePhrasemCtx({
			matchedEntry,
			promptGenerate: (kind) => {
				promptCalls.push(kind);
				if (kind === "PhrasemEnrichment") {
					return okAsync({
						emojiDescription: ["💬"],
						ipa: "ipa",
						linguisticUnit: "Phrasem",
						posLikeKind: "Idiom",
					});
				}
				if (kind === "WordTranslation") {
					return okAsync("idiom translation");
				}
				return okAsync("unused");
			},
		});

		const result = await generateSections(ctx);
		expect(result.isOk()).toBe(true);
		expect(promptCalls).toContain("PhrasemEnrichment");
		expect(promptCalls).toContain("WordTranslation");

		const translationSection = matchedEntry.sections.find(
			(s) => s.kind === "translations",
		);
		expect(translationSection?.content).toBe("idiom translation");
	});

	it("still requests WordTranslation before relation regeneration", async () => {
		const promptCalls: string[] = [];
		const matchedEntry: DictEntry = {
			headerContent: "Entry",
			id: PHRASEM_ENTRY_ID,
			meta: {},
			sections: [
				section("kontexte", "![[Other#^2|^]]"),
				section("translations", "existing translation"),
			],
		};
		const ctx = makePhrasemCtx({
			matchedEntry,
			promptGenerate: (kind) => {
				promptCalls.push(kind);
				if (kind === "PhrasemEnrichment") {
					return okAsync({
						emojiDescription: ["💬"],
						ipa: "ipa",
						linguisticUnit: "Phrasem",
						posLikeKind: "Idiom",
					});
				}
				if (kind === "Relation") {
					return okAsync({
						relations: [{ kind: "Synonym", words: ["nah"] }],
					});
				}
				if (kind === "WordTranslation") {
					return okAsync("fresh translation");
				}
				return okAsync("unused");
			},
		});

		const result = await generateSections(ctx);
		expect(result.isOk()).toBe(true);
		expect(promptCalls).toContain("Relation");
		expect(promptCalls).toContain("WordTranslation");

		const relationSection = matchedEntry.sections.find(
			(s) => s.kind === "synonyme",
		);
		expect(relationSection?.content).toContain("= [[nah]]");
	});

	it("does not require morphem/inflection for proper-noun re-encounter", async () => {
		const promptCalls: string[] = [];
		const matchedEntry: DictEntry = {
			headerContent: "Entry",
			id: NOUN_ENTRY_ID,
			meta: {
				entity: {
					features: {
						inflectional: {},
						lexical: { nounClass: "Proper", pos: "Noun" },
					},
					linguisticUnit: "Lexem",
					posLikeKind: "Noun",
				} as unknown as NonNullable<DictEntry["meta"]["entity"]>,
			},
			sections: [
				section("kontexte", "![[Src#^1|^]]"),
				section("translations", "proper noun"),
				section("tags", "#noun"),
			],
		};
		const ctx = {
			actions: [],
			commandContext: {
				activeFile: {
					content: "",
					splitPath: {
						basename: "name",
						extension: "md",
						kind: "MdFile",
						pathParts: ["Worter"],
					},
				},
			},
			existingEntries: [matchedEntry],
			matchedEntry,
			nextIndex: 2,
			resultingActions: [],
			textfresserState: {
				inFlightGenerate: null,
				languages: { known: "English", target: "German" },
				latestFailedSections: [],
				latestLemmaInvocationCache: null,
				latestLemmaResult: {
					attestation: {
						source: {
							ref: "![[Src#^1|^]]",
							textRaw: "context",
							textWithOnlyTargetMarked: "context [Name]",
						},
						target: { surface: "Name" },
					},
					disambiguationResult: { matchedIndex: 1 },
					lemma: "Name",
					linguisticUnit: "Lexem",
					posLikeKind: "Noun",
					surfaceKind: "Lemma",
				},
				lookupInLibrary: () => [],
				promptRunner: {
					generate: (kind: string) => {
						promptCalls.push(kind);
						return okAsync("unused");
					},
				},
				vam: {},
			} as unknown as TextfresserState,
		} as unknown as ResolvedEntryState;

		const result = await generateSections(ctx);
		expect(result.isOk()).toBe(true);
		expect(promptCalls).toHaveLength(0);
	});
});
