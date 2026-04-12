import { describe, expect, it } from "bun:test";
import { err, errAsync, ok, okAsync, type ResultAsync } from "neverthrow";
import { generateSections } from "../../../../src/commanders/textfresser/commands/generate/steps/generate-sections";
import {
	findFirstTypedSectionByMarker,
	getTypedSectionContent,
} from "../../../../src/commanders/textfresser/commands/generate/steps/canonical-note-entry";
import type { ResolvedEntryState } from "../../../../src/commanders/textfresser/commands/generate/steps/resolve-existing-entry";
import type { NoteEntry } from "../../../../src/commanders/textfresser/core/notes/types";
import { buildSectionMarker } from "../../../../src/commanders/textfresser/domain/dict-note/internal/constants";
import type {
	DictEntry as LegacyDictEntry,
	EntrySection,
} from "../../../../src/commanders/textfresser/domain/dict-note/types";
import { fromLegacyDictEntry } from "../../../../src/commanders/textfresser/domain/dict-note";
import { deLanguagePack } from "../../../../src/commanders/textfresser/languages/de/pack";
import type { TextfresserState } from "../../../../src/commanders/textfresser/state/textfresser-state";
import { cssSuffixFor } from "../../../../src/commanders/textfresser/targets/de/sections/section-css-kind";
import {
	ALL_DICT_SECTION_KINDS,
	TitleReprFor,
} from "../../../../src/commanders/textfresser/targets/de/sections/section-kind";
import {
	LexicalGenerationFailureKind,
	type LexicalGenerationModule,
	type LexicalInfo,
	lexicalGenerationError,
} from "@textfresser/lexical-generation";
import {
	makeLexemeLemmaResult,
	makeLexemeLexicalInfo,
	makePhrasemeLemmaResult,
	makePhrasemeLexicalInfo,
	makeRelations,
} from "../helpers/native-fixtures";

const PHRASEM_ENTRY_ID = "PH-LM-1";
const NOUN_ENTRY_ID = "LX-LM-NOUN-1";
const PRONOUN_ENTRY_ID = "LX-LM-PRON-1";

const titleByCssKind = new Map(
	ALL_DICT_SECTION_KINDS.map((kind) => [
		cssSuffixFor[kind],
		TitleReprFor[kind].German,
	]),
);

function section(kind: string, content: string): EntrySection {
	return {
		content,
		kind,
		title:
			kind === "closed_set_membership"
				? "Closed-set membership"
				: (titleByCssKind.get(kind) ?? kind),
	};
}

function entry(input: LegacyDictEntry): NoteEntry {
	return fromLegacyDictEntry(input, deLanguagePack);
}

function sectionContent(
	entryValue: NoteEntry | undefined,
	marker: string,
): string | undefined {
	if (!entryValue) {
		return undefined;
	}
	const section = findFirstTypedSectionByMarker(entryValue, marker);
	if (section) {
		return getTypedSectionContent(section);
	}
	const rawSection = entryValue.sections.find(
		(
			candidate,
		): candidate is Extract<NoteEntry["sections"][number], { kind: "raw" }> =>
			candidate.kind === "raw" && candidate.marker === marker,
	);
	if (!rawSection || !rawSection.title || !rawSection.marker) {
		return undefined;
	}
	const markerText = buildSectionMarker(rawSection.marker, rawSection.title);
	if (!rawSection.rawBlock.startsWith(markerText)) {
		return undefined;
	}
	return rawSection.rawBlock
		.slice(markerText.length)
		.trim()
		.split("\n")
		.map((line) => line.trimEnd())
		.join("\n");
}

function hasSection(entryValue: NoteEntry | undefined, marker: string): boolean {
	return entryValue
		? findFirstTypedSectionByMarker(entryValue, marker) !== undefined
		: false;
}

function sectionMarkers(entryValue: NoteEntry): string[] {
	return entryValue.sections
		.map((section) => section.marker)
		.filter((marker): marker is string => typeof marker === "string");
}

function makeLexicalGeneration(
	lexicalInfo: LexicalInfo,
): LexicalGenerationModule {
	return {
		generateLexicalInfo: async () => ok(lexicalInfo),
	} as unknown as LexicalGenerationModule;
}

function makeTrackingLexicalGeneration(params: {
	lexicalInfo: LexicalInfo;
	onGenerateLexicalInfo: () => void;
}): LexicalGenerationModule {
	return {
		generateLexicalInfo: async () => {
			params.onGenerateLexicalInfo();
			return ok(params.lexicalInfo);
		},
	} as unknown as LexicalGenerationModule;
}

function makePhrasemLexicalInfo(): LexicalInfo {
	return makePhrasemeLexicalInfo({
		core: {
			status: "ready",
			value: {
				emojiDescription: ["💬"],
				ipa: "ipa",
			},
		},
		lemma: "redensart",
		relations: makeRelations([{ kind: "Synonym", words: ["nah"] }]),
	});
}

function makePronounLexicalInfo(): LexicalInfo {
	return makeLexemeLexicalInfo({
		core: {
			status: "ready",
			value: {
				emojiDescription: ["👥"],
				ipa: "viːɐ̯",
			},
		},
		features: {
			status: "ready",
			value: {
				inherentFeatures: {},
			},
		},
		inflections: {
			status: "ready",
			value: {
				kind: "generic",
				rows: [{ forms: [{ form: "wir" }], label: "Nom" }],
			},
		},
		lemma: "wir",
		pos: "PRON",
	});
}

function makePhrasemCtx(params: {
	matchedEntry: NoteEntry;
	lexicalInfo?: LexicalInfo;
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
				latestLemmaResult: makePhrasemeLemmaResult({
						attestation: {
							source: {
								path: {
									basename: "source",
									extension: "md",
									kind: "MdFile",
									pathParts: ["Texts"],
								},
								ref: "![[Src#^1|^]]",
								textRaw: "context",
								textWithOnlyTargetMarked: "context [redensart]",
						},
						target: { surface: "redensart" },
					},
					disambiguationResult: { matchedIndex: 1 },
					lemma: "redensart",
				}),
			lexicalGeneration: makeLexicalGeneration(
				params.lexicalInfo ?? makePhrasemLexicalInfo(),
			),
			lookupInLibrary: () => [],
			promptRunner: {
				generate: (kind: string) => params.promptGenerate(kind),
			},
			vam: {},
		} as unknown as TextfresserState,
	} as unknown as ResolvedEntryState;
}

function makeClosedSetLexemCtx(params: {
	matchedEntry: NoteEntry;
	lexicalInfo?: LexicalInfo;
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
				latestLemmaResult: makeLexemeLemmaResult({
						attestation: {
							source: {
								path: {
									basename: "source",
									extension: "md",
									kind: "MdFile",
									pathParts: ["Texts"],
								},
								ref: "![[Src#^7|^]]",
								textRaw: "Wir arbeiten zusammen.",
								textWithOnlyTargetMarked: "[Wir] arbeiten zusammen.",
						},
						target: { surface: "Wir" },
					},
					disambiguationResult: { matchedIndex: 1 },
					lemma: "wir",
					pos: "PRON",
				}),
			lexicalGeneration: makeLexicalGeneration(
				params.lexicalInfo ?? makePronounLexicalInfo(),
			),
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
		let lexicalInfoCalls = 0;
		const matchedEntry = entry({
			headerContent: "Entry",
			id: PHRASEM_ENTRY_ID,
			meta: {},
			sections: [
				section("kontexte", "![[Other#^2|^]]"),
				section("synonyme", "= [[nah]]"),
				section("translations", "idiom"),
			],
		});
		const ctx = makePhrasemCtx({
			matchedEntry,
			promptGenerate: (kind) => {
				promptCalls.push(kind);
				return okAsync("unused");
			},
		});
		ctx.textfresserState.lexicalGeneration = makeTrackingLexicalGeneration({
			lexicalInfo: makePhrasemLexicalInfo(),
			onGenerateLexicalInfo: () => {
				lexicalInfoCalls += 1;
			},
		});

		const result = await generateSections(ctx);
		expect(result.isOk()).toBe(true);
		expect(promptCalls).toHaveLength(0);
		expect(lexicalInfoCalls).toBe(0);

		expect(sectionContent(matchedEntry, "kontexte")).toContain(
			"![[Other#^2|^]]",
		);
		expect(sectionContent(matchedEntry, "kontexte")).toContain(
			"![[Src#^1|^]]",
		);
	});

	it("regenerates and merges missing V3 sections on re-encounter", async () => {
		const promptCalls: string[] = [];
		const matchedEntry = entry({
			headerContent: "Entry",
			id: PHRASEM_ENTRY_ID,
			meta: {},
			sections: [
				section("kontexte", "![[Other#^2|^]]"),
				section("synonyme", "= [[nah]]"),
			],
		});
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
		expect(promptCalls).toContain("WordTranslation");

		expect(sectionContent(matchedEntry, "translations")).toBe(
			"idiom translation",
		);
	});

	it("still requests WordTranslation before relation regeneration", async () => {
		const promptCalls: string[] = [];
		const matchedEntry = entry({
			headerContent: "Entry",
			id: PHRASEM_ENTRY_ID,
			meta: {},
			sections: [
				section("kontexte", "![[Other#^2|^]]"),
				section("translations", "existing translation"),
			],
		});
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
		expect(promptCalls).toContain("WordTranslation");

		expect(sectionContent(matchedEntry, "synonyme")).toContain("= [[nah]]");
	});

	it("does not require morphem/inflection for proper-noun re-encounter", async () => {
		const promptCalls: string[] = [];
		const matchedEntry = entry({
			headerContent: "Entry",
			id: NOUN_ENTRY_ID,
			meta: {
				entity: {
					features: {
						inflectional: {},
						lexical: { nounClass: "Proper", pos: "NOUN" },
					},
					linguisticUnit: "Lexeme",
					posLikeKind: "NOUN",
				} as unknown as NonNullable<LegacyDictEntry["meta"]["entity"]>,
			},
			sections: [
				section("kontexte", "![[Src#^1|^]]"),
				section("translations", "proper noun"),
				section("tags", "#noun"),
			],
		});
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
					latestLemmaResult: makeLexemeLemmaResult({
							attestation: {
								source: {
									path: {
										basename: "source",
										extension: "md",
										kind: "MdFile",
										pathParts: ["Texts"],
									},
									ref: "![[Src#^1|^]]",
									textRaw: "context",
									textWithOnlyTargetMarked: "context [Name]",
							},
							target: { surface: "Name" },
						},
						disambiguationResult: { matchedIndex: 1 },
						lemma: "Name",
						pos: "PROPN",
					}),
					lexicalGeneration: makeLexicalGeneration({
						...makeLexemeLexicalInfo({
							core: {
								status: "ready",
								value: {
									emojiDescription: ["🏙️"],
									ipa: "bɛʁˈliːn",
								},
							},
							features: {
								status: "ready",
								value: {
									inherentFeatures: {},
								},
							},
							lemma: "Name",
							pos: "PROPN",
						}),
					}),
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

	it("uses stored proper-noun metadata on re-encounter when lexical noun features degrade", async () => {
		const promptCalls: string[] = [];
		let lexicalInfoCalls = 0;
		const matchedEntry = entry({
			headerContent: "Entry",
			id: NOUN_ENTRY_ID,
			meta: {
				entity: {
					features: {
						inflectional: {},
						lexical: { pos: "NOUN" },
					},
					linguisticUnit: "Lexeme",
					posLikeKind: "NOUN",
				} as unknown as NonNullable<LegacyDictEntry["meta"]["entity"]>,
				linguisticUnit: {
					kind: "Lexeme",
					surface: {
						features: {
							genus: "Neut",
							nounClass: "Proper",
							pos: "NOUN",
						},
						lemma: "Berlin",
						surfaceKind: "Lemma",
					},
				},
			},
			sections: [
				section("kontexte", "![[Src#^1|^]]"),
				section("tags", "#noun"),
			],
		});
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
			existingEntries: [matchedEntry],
			matchedEntry,
			nextIndex: 2,
			resultingActions: [],
			textfresserState: {
				inFlightGenerate: null,
				languages: { known: "English", target: "German" },
				latestFailedSections: [],
				latestLemmaInvocationCache: null,
					latestLemmaResult: makeLexemeLemmaResult({
							attestation: {
								source: {
									path: {
										basename: "source",
										extension: "md",
										kind: "MdFile",
										pathParts: ["Texts"],
									},
									ref: "![[Src#^1|^]]",
									textRaw: "Berlin ist gross.",
									textWithOnlyTargetMarked: "[Berlin] ist gross.",
							},
							target: { surface: "Berlin" },
						},
						disambiguationResult: { matchedIndex: 1 },
						lemma: "Berlin",
						pos: "PROPN",
					}),
				lexicalGeneration: {
					generateLexicalInfo: async () => {
						lexicalInfoCalls += 1;
							return ok(
								makeLexemeLexicalInfo({
									core: {
										status: "ready",
										value: {
											emojiDescription: ["🏙️"],
											ipa: "bɛʁˈliːn",
										},
									},
									features: {
										error: lexicalGenerationError(
											LexicalGenerationFailureKind.FetchFailed,
											"features failed",
										),
										status: "error",
									},
									lemma: "Berlin",
									pos: "PROPN",
								}),
							);
						},
				} as unknown as LexicalGenerationModule,
				lookupInLibrary: () => [],
				promptRunner: {
					generate: (kind: string) => {
						promptCalls.push(kind);
						if (kind === "WordTranslation") {
							return okAsync("Berlin");
						}
						return okAsync("unused");
					},
				},
				vam: {},
			} as unknown as TextfresserState,
		} as unknown as ResolvedEntryState;

		const result = await generateSections(ctx);
		expect(result.isOk()).toBe(true);
		if (result.isErr()) return;

		expect(lexicalInfoCalls).toBe(1);
		expect(promptCalls).toEqual(["WordTranslation"]);
		expect(sectionMarkers(matchedEntry).sort()).toEqual([
			"kontexte",
			"tags",
			"translations",
		]);
		expect(result.value.failedSections).toContain("Features");
	});

	it("fails on lexical-generation hard stop without reviving legacy prompt fallbacks", async () => {
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
					latestLemmaResult: makeLexemeLemmaResult({
							attestation: {
								source: {
									path: {
										basename: "source",
										extension: "md",
										kind: "MdFile",
										pathParts: ["Texts"],
									},
									ref: "![[Src#^3|^]]",
									textRaw: "Berlin ist gross.",
									textWithOnlyTargetMarked: "[Berlin] ist gross.",
							},
							target: { surface: "Berlin" },
						},
						lemma: "Berlin",
						pos: "PROPN",
					}),
				lexicalGeneration: {
					generateLexicalInfo: async () =>
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
									genus: "Neut",
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
		expect(result.isErr()).toBe(true);
		if (result.isOk()) return;

		expect(result.error.kind).toBe("ApiError");
		if ("reason" in result.error) {
			expect(result.error.reason).toContain("lexical info contract broke");
		}
		if ("lexicalGenerationError" in result.error) {
			expect(result.error.lexicalGenerationError?.kind).toBe(
				LexicalGenerationFailureKind.InternalContractViolation,
			);
		}
		expect(promptCalls).toEqual([]);
		expect(promptCalls).not.toContain("Relation");
		expect(promptCalls).not.toContain("Morpheme");
		expect(promptCalls).not.toContain("NounInflection");
		expect(promptCalls).not.toContain("Inflection");
	});

	it("adds closed-set membership as a dedicated lightweight entry on re-encounter", async () => {
		const promptCalls: string[] = [];
		const matchedEntry = entry({
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
		});
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

		expect(hasSection(matchedEntry, "closed_set_membership")).toBe(false);

		const membershipEntry = result.value.allEntries.find(
			(entry) =>
				entry.id !== PRONOUN_ENTRY_ID &&
				entry.sections.some(
					(section) => section.marker === "closed_set_membership",
				),
		);
		expect(membershipEntry).toBeDefined();
		expect(membershipEntry?.headerContent).toBe("wir (PRON)");
		expect(sectionContent(membershipEntry, "closed_set_membership")).toContain(
			"- [[wir-personal-pronomen-de|wir (PRON)]]",
		);
		expect(
			sectionContent(membershipEntry, "tags")?.includes("#kind/closed-set"),
		).toBe(true);
		expect(result.value.targetBlockId).toBe(PRONOUN_ENTRY_ID);
	});

	it("uses POS-aware Library target for closed-set membership entry", async () => {
		const matchedEntry = entry({
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
		});
		const ctx = makeClosedSetLexemCtx({
			matchedEntry,
			promptGenerate: () => okAsync("unused"),
		});
			ctx.textfresserState.latestLemmaResult = makeLexemeLemmaResult({
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
				pos: "PRON",
			});
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
			entry.sections.some(
				(section) => section.marker === "closed_set_membership",
			),
		);
		expect(membershipEntry).toBeDefined();
		expect(sectionContent(membershipEntry, "closed_set_membership")).toContain(
			"- [[die-demonstrativ-pronomen-de|die (PRON)]]",
		);
		expect(sectionContent(membershipEntry, "closed_set_membership")).not.toContain(
			"die-bestimmter-artikel-de",
		);
	});

	it("dedupes closed-set membership entry on repeated re-encounter", async () => {
		const promptCalls: string[] = [];
		const membershipEntry = entry({
			headerContent: "wir (PRON)",
			id: "LX-LM-PRON-2",
			meta: {},
			sections: [
				section(
					"closed_set_membership",
						"- [[wir-personal-pronomen-de|wir (PRON)]]",
				),
				section("tags", "#kind/closed-set"),
			],
		});
		const matchedEntry = entry({
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
		});
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
			entry.sections.some(
				(section) => section.marker === "closed_set_membership",
			),
		);
		expect(membershipEntries).toHaveLength(1);
		expect(membershipEntries[0]?.id).toBe("LX-LM-PRON-2");
	});

	it("reuses existing membership entry when legacy pointer basename becomes stale", async () => {
		const membershipEntry = entry({
			headerContent: "wir (PRON)",
			id: "LX-LM-PRON-2",
			meta: {},
			sections: [
				section(
					"closed_set_membership",
						"- [[wir-alt-personal-pronomen-de|wir (PRON)]]",
				),
				section("tags", "#kind/closed-set"),
			],
		});
		const matchedEntry = entry({
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
		});
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
				(section) => section.marker === "closed_set_membership",
			),
		);
		expect(membershipEntries).toHaveLength(1);
		expect(membershipEntries[0]?.id).toBe("LX-LM-PRON-2");
			expect(sectionContent(membershipEntries[0], "closed_set_membership")).toBe(
				"- [[wir-personal-pronomen-de|wir (PRON)]]",
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
				latestLemmaResult: makeLexemeLemmaResult({
					attestation: {
						source: {
							path: {
								basename: "source",
								extension: "md",
								kind: "MdFile",
								pathParts: ["Texts"],
							},
							ref: "![[Src#^1|^]]",
							textRaw: "Ja, das stimmt.",
							textWithOnlyTargetMarked: "[Ja], das stimmt.",
						},
						target: { surface: "Ja" },
					},
					lemma: "ja",
					pos: "INTJ",
				}),
					lexicalGeneration: makeLexicalGeneration(
						makeLexemeLexicalInfo({
							core: {
								error: lexicalGenerationError(
									LexicalGenerationFailureKind.FetchFailed,
									"core failed",
								),
								status: "error",
							},
							features: {
								error: lexicalGenerationError(
									LexicalGenerationFailureKind.FetchFailed,
									"features failed",
								),
								status: "error",
							},
							lemma: "ja",
							morphemicBreakdown: {
								error: lexicalGenerationError(
									LexicalGenerationFailureKind.FetchFailed,
									"morphem failed",
								),
								status: "error",
							},
							pos: "INTJ",
							relations: {
								error: lexicalGenerationError(
									LexicalGenerationFailureKind.FetchFailed,
									"relation failed",
								),
								status: "error",
							},
						}),
					),
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

		expect(promptCalls).toEqual(["WordTranslation"]);
		expect(result.value.allEntries).toHaveLength(1);
		const onlyEntry = result.value.allEntries[0];
		expect(onlyEntry?.sections).toHaveLength(1);
		expect(onlyEntry?.sections[0]?.marker).toBe("kontexte");
		expect(sectionContent(onlyEntry, "kontexte")).toBe("![[Src#^1|^]]");
		expect(result.value.failedSections).toContain("Enrichment");
		expect(result.value.failedSections).toContain("Features");
		expect(result.value.failedSections).toContain("Morpheme");
		expect(result.value.failedSections).toContain("Relation");
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
				latestLemmaResult: makeLexemeLemmaResult({
					attestation: {
						source: {
							path: {
								basename: "source",
								extension: "md",
								kind: "MdFile",
								pathParts: ["Texts"],
							},
							ref: "![[Src#^9|^]]",
							textRaw: "Wir lernen.",
							textWithOnlyTargetMarked: "[Wir] lernen.",
						},
						target: { surface: "Wir" },
					},
					lemma: "wir",
					pos: "PRON",
				}),
				lexicalGeneration: makeLexicalGeneration(makePronounLexicalInfo()),
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

		expect(promptCalls).toEqual(["WordTranslation"]);
		expect(result.value.allEntries).toHaveLength(2);
		expect(result.value.targetBlockId).toBe("LX-LM-PRON-1");

		const membershipEntry = result.value.allEntries.find((entry) =>
			entry.sections.some(
				(section) => section.marker === "closed_set_membership",
			),
		);
		expect(membershipEntry).toBeDefined();
		expect(membershipEntry?.id).toBe("LX-LM-PRON-2");
		expect(membershipEntry?.headerContent).toBe("wir (PRON)");
		expect(
			sectionContent(membershipEntry, "closed_set_membership")?.includes(
				"- [[wir-personal-pronomen-de|wir (PRON)]]",
			),
		).toBe(true);
	});
});
