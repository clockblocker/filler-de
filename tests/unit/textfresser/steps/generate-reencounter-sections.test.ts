import { describe, expect, it } from "bun:test";
import { err, errAsync, okAsync, type ResultAsync } from "neverthrow";
import {
	type LexicalGenerationModule,
	LexicalGenerationFailureKind,
	lexicalGenerationError,
} from "../../../../src/lexical-generation";
import { generateSections } from "../../../../src/commanders/textfresser/commands/generate/steps/generate-sections";
import type { ResolvedEntryState } from "../../../../src/commanders/textfresser/commands/generate/steps/resolve-existing-entry";
import type {
	DictEntry,
	EntrySection,
} from "../../../../src/commanders/textfresser/domain/dict-note/types";
import type { TextfresserState } from "../../../../src/commanders/textfresser/state/textfresser-state";

const PHRASEM_ENTRY_ID = "PH-LM-1";
const NOUN_ENTRY_ID = "LX-LM-NOUN-1";
const PRONOUN_ENTRY_ID = "LX-LM-PRON-1";

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

function makeClosedSetLexemCtx(params: {
	matchedEntry: DictEntry;
	promptGenerate: (kind: string) => ResultAsync<unknown, unknown>;
}): ResolvedEntryState {
	return {
		actions: [],
		commandContext: {
			activeFile: {
				content: "",
				splitPath: {
					basename: "wir",
					extension: "md",
					kind: "MdFile",
					pathParts: ["Worter", "de", "lexem", "lemma", "w", "wir", "wir"],
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
						ref: "![[Src#^7|^]]",
						textRaw: "Wir arbeiten zusammen.",
						textWithOnlyTargetMarked: "[Wir] arbeiten zusammen.",
					},
					target: { surface: "Wir" },
				},
				disambiguationResult: { matchedIndex: 1 },
				lemma: "wir",
				linguisticUnit: "Lexem",
				posLikeKind: "Pronoun",
				surfaceKind: "Lemma",
			},
			lookupInLibrary: () => [
				{
					basename: "wir-personal-pronomen-de",
					extension: "md",
					kind: "MdFile",
					pathParts: ["Library", "de", "pronoun"],
				},
			],
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

	it("falls back from lexical-generation hard stop without non-applicable prompt calls", async () => {
		const promptCalls: string[] = [];
		const ctx = {
			actions: [],
			commandContext: {
				activeFile: {
					content: "",
					splitPath: {
						basename: "berlin",
						extension: "md",
						kind: "MdFile",
						pathParts: ["Worter"],
					},
				},
			},
			existingEntries: [],
			matchedEntry: null,
			nextIndex: 1,
			resultingActions: [],
			textfresserState: {
				inFlightGenerate: null,
				languages: { known: "English", target: "German" },
				latestFailedSections: [],
				latestLemmaInvocationCache: null,
				latestLemmaResult: {
					attestation: {
						source: {
							ref: "![[Src#^3|^]]",
							textRaw: "Berlin ist gross.",
							textWithOnlyTargetMarked: "[Berlin] ist gross.",
						},
						target: { surface: "Berlin" },
					},
					disambiguationResult: null,
					lemma: "Berlin",
					linguisticUnit: "Lexem",
					posLikeKind: "Noun",
					surfaceKind: "Lemma",
				},
				lexicalGeneration: {
					buildLexicalInfoGenerator: () => async () =>
						err(
							lexicalGenerationError(
								LexicalGenerationFailureKind.InternalContractViolation,
								"lexical info contract broke",
							),
						),
				} as unknown as LexicalGenerationModule,
				lookupInLibrary: () => [],
				promptRunner: {
					generate: (kind: string) => {
						promptCalls.push(kind);
						switch (kind) {
							case "NounEnrichment":
								return okAsync({
									emojiDescription: ["🏙️"],
									genus: "Neutrum",
									ipa: "bɛʁˈliːn",
									nounClass: "Proper",
								});
							case "FeaturesNoun":
								return okAsync({ tags: ["city"] });
							case "WordTranslation":
								return okAsync("Berlin");
							default:
								throw new Error(`unexpected prompt ${kind}`);
						}
					},
				},
				vam: {},
			} as unknown as TextfresserState,
		} as unknown as ResolvedEntryState;

		const result = await generateSections(ctx);
		expect(result.isOk()).toBe(true);
		if (result.isErr()) return;

		expect(result.value.failedSections).toEqual([]);
		expect(ctx.textfresserState.latestFailedSections).toEqual([]);
		expect(promptCalls).toEqual([
			"NounEnrichment",
			"FeaturesNoun",
			"WordTranslation",
		]);
		expect(promptCalls).not.toContain("Relation");
		expect(promptCalls).not.toContain("Morphem");
		expect(promptCalls).not.toContain("NounInflection");
		expect(promptCalls).not.toContain("Inflection");
	});

	it("adds closed-set membership as a dedicated lightweight entry on re-encounter", async () => {
		const promptCalls: string[] = [];
		const matchedEntry: DictEntry = {
			headerContent: "Entry",
			id: PRONOUN_ENTRY_ID,
			meta: {},
			sections: [
				section("kontexte", "![[Other#^2|^]]"),
				section("synonyme", "= [[wir]]"),
				section("morpheme", "[[wir]]"),
				section("morphologie", "Abgeleitet von: [[wir]]"),
				section("flexion", "Nom: [[wir]]"),
				section("tags", "#pronoun/personal"),
				section("translations", "we"),
			],
		};
		const ctx = makeClosedSetLexemCtx({
			matchedEntry,
			promptGenerate: (kind) => {
				promptCalls.push(kind);
				return okAsync("unused");
			},
		});

		const result = await generateSections(ctx);
		expect(result.isOk()).toBe(true);
		expect(promptCalls).toHaveLength(0);
		if (result.isErr()) return;

		const closedSetRefs = matchedEntry.sections.find(
			(s) => s.kind === "closed_set_membership",
		);
		expect(closedSetRefs).toBeUndefined();

		const membershipEntry = result.value.allEntries.find(
			(entry) =>
				entry.id !== PRONOUN_ENTRY_ID &&
				entry.sections.some(
					(section) => section.kind === "closed_set_membership",
				),
		);
		expect(membershipEntry).toBeDefined();
		expect(membershipEntry?.headerContent).toBe("wir (Pronoun)");
		const membershipSection = membershipEntry?.sections.find(
			(s) => s.kind === "closed_set_membership",
		);
		expect(membershipSection?.content).toContain(
			"- [[wir-personal-pronomen-de|wir (Pronoun)]]",
		);
		expect(
			membershipEntry?.sections.some(
				(s) => s.kind === "tags" && s.content.includes("#kind/closed-set"),
			),
		).toBe(true);
		expect(result.value.targetBlockId).toBe(PRONOUN_ENTRY_ID);
	});

	it("uses POS-aware Library target for closed-set membership entry", async () => {
		const matchedEntry: DictEntry = {
			headerContent: "Entry",
			id: PRONOUN_ENTRY_ID,
			meta: {},
			sections: [
				section("kontexte", "![[Other#^2|^]]"),
				section("synonyme", "= [[die]]"),
				section("morpheme", "[[die]]"),
				section("morphologie", "Abgeleitet von: [[die]]"),
				section("flexion", "Nom: [[die]]"),
				section("tags", "#pronoun/personal"),
				section("translations", "they"),
			],
		};
		const ctx = makeClosedSetLexemCtx({
			matchedEntry,
			promptGenerate: () => okAsync("unused"),
		});
		ctx.textfresserState.latestLemmaResult = {
			attestation: {
				source: {
					path: {
						basename: "source",
						extension: "md",
						kind: "MdFile",
						pathParts: ["Texts"],
					},
					ref: "![[Src#^11|^]]",
					textRaw: "Die arbeiten zusammen.",
					textWithOnlyTargetMarked: "[Die] arbeiten zusammen.",
				},
				target: { surface: "Die" },
			},
			disambiguationResult: { matchedIndex: 1 },
			lemma: "die",
			linguisticUnit: "Lexem",
			posLikeKind: "Pronoun",
			surfaceKind: "Lemma",
		};
		ctx.textfresserState.lookupInLibrary = () => [
			{
				basename: "die-bestimmter-artikel-de",
				extension: "md",
				kind: "MdFile",
				pathParts: ["Library", "de", "artikel", "bestimmter"],
			},
			{
				basename: "die-relativ-pronomen-de",
				extension: "md",
				kind: "MdFile",
				pathParts: ["Library", "de", "pronomen", "relativ"],
			},
			{
				basename: "die-demonstrativ-pronomen-de",
				extension: "md",
				kind: "MdFile",
				pathParts: ["Library", "de", "pronomen", "demonstrativ"],
			},
		];

		const result = await generateSections(ctx);
		expect(result.isOk()).toBe(true);
		if (result.isErr()) return;

		const membershipEntry = result.value.allEntries.find((entry) =>
			entry.sections.some((section) => section.kind === "closed_set_membership"),
		);
		expect(membershipEntry).toBeDefined();
		const membershipSection = membershipEntry?.sections.find(
			(section) => section.kind === "closed_set_membership",
		);
		expect(membershipSection?.content).toContain(
			"- [[die-demonstrativ-pronomen-de|die (Pronoun)]]",
		);
		expect(membershipSection?.content).not.toContain(
			"die-bestimmter-artikel-de",
		);
	});

	it("dedupes closed-set membership entry on repeated re-encounter", async () => {
		const promptCalls: string[] = [];
		const membershipEntry: DictEntry = {
			headerContent: "wir (Pronoun)",
			id: "LX-LM-PRON-2",
			meta: {},
			sections: [
				section(
					"closed_set_membership",
					"- [[wir-personal-pronomen-de|wir (Pronoun)]]",
				),
				section("tags", "#kind/closed-set"),
			],
		};
		const matchedEntry: DictEntry = {
			headerContent: "Entry",
			id: PRONOUN_ENTRY_ID,
			meta: {},
			sections: [
				section("kontexte", "![[Other#^2|^]]"),
				section("synonyme", "= [[wir]]"),
				section("morpheme", "[[wir]]"),
				section("morphologie", "Abgeleitet von: [[wir]]"),
				section("flexion", "Nom: [[wir]]"),
				section("tags", "#pronoun/personal"),
				section("translations", "we"),
			],
		};
		const ctx = makeClosedSetLexemCtx({
			matchedEntry,
			promptGenerate: (kind) => {
				promptCalls.push(kind);
				return okAsync("unused");
			},
		});
		ctx.existingEntries = [matchedEntry, membershipEntry];

		const result = await generateSections(ctx);
		expect(result.isOk()).toBe(true);
		expect(promptCalls).toHaveLength(0);
		if (result.isErr()) return;

		const membershipEntries = result.value.allEntries.filter((entry) =>
			entry.sections.some((section) => section.kind === "closed_set_membership"),
		);
		expect(membershipEntries).toHaveLength(1);
		expect(membershipEntries[0]?.id).toBe("LX-LM-PRON-2");
	});

	it("reuses existing membership entry when legacy pointer basename becomes stale", async () => {
		const membershipEntry: DictEntry = {
			headerContent: "wir (Pronoun)",
			id: "LX-LM-PRON-2",
			meta: {},
			sections: [
				section(
					"closed_set_membership",
					"- [[wir-alt-personal-pronomen-de|wir (Pronoun)]]",
				),
				section("tags", "#kind/closed-set"),
			],
		};
		const matchedEntry: DictEntry = {
			headerContent: "Entry",
			id: PRONOUN_ENTRY_ID,
			meta: {},
			sections: [
				section("kontexte", "![[Other#^2|^]]"),
				section("synonyme", "= [[wir]]"),
				section("morpheme", "[[wir]]"),
				section("morphologie", "Abgeleitet von: [[wir]]"),
				section("flexion", "Nom: [[wir]]"),
				section("tags", "#pronoun/personal"),
				section("translations", "we"),
			],
		};
		const ctx = makeClosedSetLexemCtx({
			matchedEntry,
			promptGenerate: () => okAsync("unused"),
		});
		ctx.existingEntries = [matchedEntry, membershipEntry];

		const result = await generateSections(ctx);
		expect(result.isOk()).toBe(true);
		if (result.isErr()) return;

		const membershipEntries = result.value.allEntries.filter((entry) =>
			entry.sections.some(
				(section) => section.kind === "closed_set_membership",
			),
		);
		expect(membershipEntries).toHaveLength(1);
		expect(membershipEntries[0]?.id).toBe("LX-LM-PRON-2");
		const membershipSection = membershipEntries[0]?.sections.find(
			(section) => section.kind === "closed_set_membership",
		);
		expect(membershipSection?.content).toBe(
			"- [[wir-personal-pronomen-de|wir (Pronoun)]]",
		);
	});
});

describe("generateSections new-entry resilience", () => {
	it("creates a non-empty entry when enrichment and other sections fail", async () => {
		const promptCalls: string[] = [];
		const ctx = {
			actions: [],
			commandContext: {
				activeFile: {
					content: "",
					splitPath: {
						basename: "ja",
						extension: "md",
						kind: "MdFile",
						pathParts: ["Worter"],
					},
				},
			},
			existingEntries: [],
			matchedEntry: null,
			nextIndex: 1,
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
							textRaw: "Ja, das stimmt.",
							textWithOnlyTargetMarked: "[Ja], das stimmt.",
						},
						target: { surface: "Ja" },
					},
					disambiguationResult: null,
					lemma: "ja",
					linguisticUnit: "Lexem",
					posLikeKind: "InteractionalUnit",
					surfaceKind: "Lemma",
				},
				lookupInLibrary: () => [],
				promptRunner: {
					generate: (kind: string) => {
						promptCalls.push(kind);
						return errAsync({ reason: `${kind} failed` });
					},
				},
				vam: {},
			} as unknown as TextfresserState,
		} as unknown as ResolvedEntryState;

		const result = await generateSections(ctx);
		expect(result.isOk()).toBe(true);
		if (result.isErr()) return;

		expect(promptCalls).toContain("LexemEnrichment");
		expect(result.value.allEntries).toHaveLength(1);
		const onlyEntry = result.value.allEntries[0];
		expect(onlyEntry?.sections).toHaveLength(1);
		expect(onlyEntry?.sections[0]?.kind).toBe("kontexte");
		expect(onlyEntry?.sections[0]?.content).toBe("![[Src#^1|^]]");
		expect(result.value.failedSections).toContain("Enrichment");
		expect(result.value.failedSections).toContain("Translation");
	});

	it("creates a separate closed-set membership entry on closed-set first encounter", async () => {
		const promptCalls: string[] = [];
		const ctx = {
			actions: [],
			commandContext: {
				activeFile: {
					content: "",
					splitPath: {
						basename: "wir",
						extension: "md",
						kind: "MdFile",
						pathParts: ["Worter"],
					},
				},
			},
			existingEntries: [],
			matchedEntry: null,
			nextIndex: 1,
			resultingActions: [],
			textfresserState: {
				inFlightGenerate: null,
				languages: { known: "English", target: "German" },
				latestFailedSections: [],
				latestLemmaInvocationCache: null,
				latestLemmaResult: {
					attestation: {
						source: {
							ref: "![[Src#^9|^]]",
							textRaw: "Wir lernen.",
							textWithOnlyTargetMarked: "[Wir] lernen.",
						},
						target: { surface: "Wir" },
					},
					disambiguationResult: null,
					lemma: "wir",
					linguisticUnit: "Lexem",
					posLikeKind: "Pronoun",
					surfaceKind: "Lemma",
				},
				lookupInLibrary: () => [
					{
						basename: "wir-personal-pronomen-de",
						extension: "md",
						kind: "MdFile",
						pathParts: ["Library", "de", "pronoun"],
					},
				],
				promptRunner: {
					generate: (kind: string) => {
						promptCalls.push(kind);
						return errAsync({ reason: `${kind} failed` });
					},
				},
				vam: {},
			} as unknown as TextfresserState,
		} as unknown as ResolvedEntryState;

		const result = await generateSections(ctx);
		expect(result.isOk()).toBe(true);
		if (result.isErr()) return;

		expect(promptCalls).toContain("LexemEnrichment");
		expect(result.value.allEntries).toHaveLength(2);
		expect(result.value.targetBlockId).toBe("LX-LM-PRON-1");

		const membershipEntry = result.value.allEntries.find((entry) =>
			entry.sections.some((section) => section.kind === "closed_set_membership"),
		);
		expect(membershipEntry).toBeDefined();
		expect(membershipEntry?.id).toBe("LX-LM-PRON-2");
		expect(membershipEntry?.headerContent).toBe("wir (Pronoun)");
		expect(
			membershipEntry?.sections.some(
				(section) =>
					section.kind === "closed_set_membership" &&
					section.content.includes(
						"- [[wir-personal-pronomen-de|wir (Pronoun)]]",
					),
			),
		).toBe(true);
	});
});
