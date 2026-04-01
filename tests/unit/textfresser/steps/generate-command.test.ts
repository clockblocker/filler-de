import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { VaultActionKind } from "@textfresser/vault-action-manager/types/vault-action";
import { ok, okAsync } from "neverthrow";
import { generateCommand } from "../../../../src/commanders/textfresser/commands/generate/generate-command";
import { buildPolicyDestinationPath } from "../../../../src/commanders/textfresser/common/lemma-link-routing";
import { buildSectionMarker } from "../../../../src/commanders/textfresser/domain/dict-note/internal/constants";
import { dictNoteHelper } from "../../../../src/commanders/textfresser/domain/dict-note";
import type { TextfresserState } from "../../../../src/commanders/textfresser/state/textfresser-state";
import { clearState, initializeState } from "../../../../src/global-state/global-state";
import {
	LexicalGenerationFailureKind,
	type LexicalGenerationModule,
	type LexicalInfo,
	lexicalGenerationError,
} from "@textfresser/lexical-generation";
import { DEFAULT_SETTINGS } from "../../../../src/types";
import {
	DictSectionKind,
	TitleReprFor,
} from "../../../../src/commanders/textfresser/targets/de/sections/section-kind";
import { cssSuffixFor } from "../../../../src/commanders/textfresser/targets/de/sections/section-css-kind";

function makeProperNounLexicalInfo(): LexicalInfo {
	return {
		core: {
			status: "ready",
			value: {
				emojiDescription: ["🏙️"],
				ipa: "bɛʁˈliːn",
				nounIdentity: {
					genus: "Neutrum",
					nounClass: "Proper",
				},
			},
		},
		features: {
			error: lexicalGenerationError(
				LexicalGenerationFailureKind.FetchFailed,
				"features failed",
			),
			status: "error",
		},
		inflections: { status: "not_applicable" },
		lemma: {
			lemma: "Berlin",
			linguisticUnit: "Lexem",
			posLikeKind: "Noun",
			surfaceKind: "Lemma",
		},
		morphemicBreakdown: { status: "not_applicable" },
		relations: { status: "not_applicable" },
	};
}

function makePhrasemLexicalInfo(): LexicalInfo {
	return {
		core: {
			status: "ready",
			value: {
				emojiDescription: ["💬"],
				ipa: "ipa",
			},
		},
		features: { status: "not_applicable" },
		inflections: { status: "not_applicable" },
		lemma: {
			lemma: "redensart",
			linguisticUnit: "Phrasem",
			posLikeKind: "Idiom",
			surfaceKind: "Lemma",
		},
		morphemicBreakdown: { status: "not_applicable" },
		relations: {
			status: "ready",
			value: {
				relations: [{ kind: "Synonym", words: ["nah"] }],
			},
		},
	};
}

async function extractFinalWrittenContent(actions: readonly unknown[]) {
	const writeAction = [...actions]
		.reverse()
		.find(
			(action) =>
				typeof action === "object" &&
				action !== null &&
				"kind" in action &&
				action.kind === VaultActionKind.ProcessMdFile &&
				"payload" in action &&
				typeof action.payload === "object" &&
				action.payload !== null &&
				"transform" in action.payload,
		);
	if (
		!writeAction ||
		typeof writeAction !== "object" ||
		!("kind" in writeAction) ||
		writeAction.kind !== VaultActionKind.ProcessMdFile ||
		!("payload" in writeAction) ||
		typeof writeAction.payload !== "object" ||
		writeAction.payload === null ||
		!("transform" in writeAction.payload)
	) {
		throw new Error("expected final ProcessMdFile write action");
	}

	const payload = writeAction.payload as { transform: (input: string) => Promise<string> | string };
	return await payload.transform("");
}

function sectionMarker(kind: DictSectionKind): string {
	return buildSectionMarker(cssSuffixFor[kind], TitleReprFor[kind].German);
}

function makePhrasemGenerateInput(params: {
	content: string;
	lexicalInfo?: LexicalInfo;
	promptCalls?: string[];
	promptResult?: string;
}) {
	const targetPath = buildPolicyDestinationPath({
		lemma: "redensart",
		linguisticUnit: "Phrasem",
		posLikeKind: null,
		surfaceKind: "Lemma",
		targetLanguage: "German",
	});
	const promptCalls = params.promptCalls ?? [];

	return {
		commandContext: {
			activeFile: {
				content: params.content,
				splitPath: targetPath,
			},
			selection: null,
		},
		resultingActions: [],
		textfresserState: {
			attestationForLatestNavigated: null,
			inFlightGenerate: null,
			isLibraryLookupAvailable: false,
			languages: { known: "English", target: "German" },
			latestFailedSections: [],
			latestLemmaInvocationCache: null,
			latestLemmaPlaceholderPath: undefined,
			latestLemmaResult: {
				attestation: {
					source: {
						ref: "![[Src#^3|^]]",
						textRaw: "Das ist eine Redensart.",
						textWithOnlyTargetMarked: "Das ist eine [Redensart].",
					},
					target: { surface: "Redensart" },
				},
				disambiguationResult: { matchedIndex: 1 },
				lemma: "redensart",
				linguisticUnit: "Phrasem",
				posLikeKind: "Idiom",
				surfaceKind: "Lemma",
			},
			latestLemmaTargetOwnedByInvocation: false,
			latestResolvedLemmaTargetPath: targetPath,
			lexicalGeneration: {
				generateLexicalInfo: async () =>
					ok(params.lexicalInfo ?? makePhrasemLexicalInfo()),
			} as unknown as LexicalGenerationModule,
			lookupInLibrary: () => [],
			parseLibraryBasename: () => null,
			pendingGenerate: null,
			promptRunner: {
				generate: (kind: string) => {
					promptCalls.push(kind);
					return okAsync(params.promptResult ?? "fresh translation");
				},
			},
			vam: {
				findByBasename: () => [],
			},
		} as unknown as TextfresserState,
	};
}

describe("generateCommand proper-noun fallback", () => {
	beforeEach(() => {
		initializeState(DEFAULT_SETTINGS);
	});

	afterEach(() => {
		clearState();
	});

	it("keeps proper-noun sections and noun metadata when noun features fail", async () => {
		const targetPath = buildPolicyDestinationPath({
			lemma: "Berlin",
			linguisticUnit: "Lexem",
			posLikeKind: "Noun",
			surfaceKind: "Lemma",
			targetLanguage: "German",
		});
		const lexicalInfo = makeProperNounLexicalInfo();
		const promptCalls: string[] = [];
		const input = {
			commandContext: {
				activeFile: {
					content: "",
					splitPath: targetPath,
				},
				selection: null,
			},
			resultingActions: [],
			textfresserState: {
				attestationForLatestNavigated: null,
				inFlightGenerate: null,
				isLibraryLookupAvailable: false,
				languages: { known: "English", target: "German" },
				latestFailedSections: [],
				latestLemmaInvocationCache: null,
				latestLemmaPlaceholderPath: undefined,
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
				latestLemmaTargetOwnedByInvocation: false,
				latestResolvedLemmaTargetPath: targetPath,
				lexicalGeneration: {
					generateLexicalInfo: async () => ok(lexicalInfo),
				} as unknown as LexicalGenerationModule,
				lookupInLibrary: () => [],
				parseLibraryBasename: () => null,
				pendingGenerate: null,
				promptRunner: {
					generate: (kind: string) => {
						promptCalls.push(kind);
						return okAsync("Berlin");
					},
				},
				vam: {},
			} as unknown as TextfresserState,
		};

		const result = await generateCommand(input);
		expect(result.isOk()).toBe(true);
		if (result.isErr()) return;

		expect(promptCalls).toEqual(["WordTranslation"]);
		expect(result.value).toHaveLength(1);
		expect(result.value[0]?.kind).toBe(VaultActionKind.ProcessMdFile);

		const writeAction = result.value[0];
		if (
			!writeAction ||
			writeAction.kind !== VaultActionKind.ProcessMdFile
		) {
			throw new Error("expected final ProcessMdFile write action");
		}

		const serialized = await extractFinalWrittenContent(result.value);
		const entries = dictNoteHelper.parse(serialized);
		expect(entries).toHaveLength(1);

		const entry = entries[0];
		expect(entry?.meta.lexicalMeta).toEqual({
			emojiDescription: ["🏙️"],
			metaTag: "lx|noun|lemma",
		});

		const sectionKinds = new Set(entry?.sections.map((section) => section.kind));
		expect(sectionKinds.has("translations")).toBe(true);
		expect(sectionKinds.has("kontexte")).toBe(true);
		expect(sectionKinds.has("synonyme")).toBe(false);
		expect(sectionKinds.has("morpheme")).toBe(false);
		expect(sectionKinds.has("morphologie")).toBe(false);
		expect(sectionKinds.has("flexion")).toBe(false);
	});

	it("preserves raw duplicate sections and manual blocks on re-encounter", async () => {
		const targetPath = buildPolicyDestinationPath({
			lemma: "redensart",
			linguisticUnit: "Phrasem",
			posLikeKind: null,
			surfaceKind: "Lemma",
			targetLanguage: "German",
		});
		const promptCalls: string[] = [];
		const content = [
			"redensart ^PH-LM-1",
			"",
			"Loose manual intro",
			"",
			sectionMarker(DictSectionKind.Attestation),
			"![[Other#^2|^]]",
			sectionMarker(DictSectionKind.Relation),
			"= [[nah]]",
			sectionMarker(DictSectionKind.Translation),
			"idiom",
			'<span class="entry_section_title entry_section_title_translations">Custom Title</span>',
			"manual translation",
			sectionMarker(DictSectionKind.FreeForm),
			"User note [[Haus]]",
		].join("\n");
		const input = {
			commandContext: {
				activeFile: {
					content,
					splitPath: targetPath,
				},
				selection: null,
			},
			resultingActions: [],
			textfresserState: {
				attestationForLatestNavigated: null,
				inFlightGenerate: null,
				isLibraryLookupAvailable: false,
				languages: { known: "English", target: "German" },
				latestFailedSections: [],
				latestLemmaInvocationCache: null,
				latestLemmaPlaceholderPath: undefined,
				latestLemmaResult: {
					attestation: {
						source: {
							ref: "![[Src#^3|^]]",
							textRaw: "Das ist eine Redensart.",
							textWithOnlyTargetMarked: "Das ist eine [Redensart].",
						},
						target: { surface: "Redensart" },
					},
					disambiguationResult: { matchedIndex: 1 },
					lemma: "redensart",
					linguisticUnit: "Phrasem",
					posLikeKind: "Idiom",
					surfaceKind: "Lemma",
				},
				latestLemmaTargetOwnedByInvocation: false,
				latestResolvedLemmaTargetPath: targetPath,
				lexicalGeneration: {
					generateLexicalInfo: async () => ok(makePhrasemLexicalInfo()),
				} as unknown as LexicalGenerationModule,
				lookupInLibrary: () => [],
				parseLibraryBasename: () => null,
				pendingGenerate: null,
				promptRunner: {
					generate: (kind: string) => {
						promptCalls.push(kind);
						return okAsync("unused");
					},
				},
				vam: {},
			} as unknown as TextfresserState,
		};

		const result = await generateCommand(input);
		expect(result.isOk()).toBe(true);
		if (result.isErr()) return;

		expect(promptCalls).toHaveLength(0);

		const serialized = await extractFinalWrittenContent(result.value);
		expect(serialized).toContain("Loose manual intro");
		expect(serialized).toContain(
			'<span class="entry_section_title entry_section_title_translations">Custom Title</span>\nmanual translation',
		);
		expect(serialized).toContain("User note [[Haus]]");
		expect(serialized).toContain("![[Other#^2|^]]\n\n![[Src#^3|^]]");
	});

	it("treats raw custom-title translation as missing and preserves the raw block", async () => {
		const targetPath = buildPolicyDestinationPath({
			lemma: "redensart",
			linguisticUnit: "Phrasem",
			posLikeKind: null,
			surfaceKind: "Lemma",
			targetLanguage: "German",
		});
		const promptCalls: string[] = [];
		const content = [
			"redensart ^PH-LM-1",
			"",
			sectionMarker(DictSectionKind.Attestation),
			"![[Other#^2|^]]",
			sectionMarker(DictSectionKind.Relation),
			"= [[nah]]",
			'<span class="entry_section_title entry_section_title_translations">Custom Title</span>',
			"manual translation",
		].join("\n");
		const input = {
			commandContext: {
				activeFile: {
					content,
					splitPath: targetPath,
				},
				selection: null,
			},
			resultingActions: [],
			textfresserState: {
				attestationForLatestNavigated: null,
				inFlightGenerate: null,
				isLibraryLookupAvailable: false,
				languages: { known: "English", target: "German" },
				latestFailedSections: [],
				latestLemmaInvocationCache: null,
				latestLemmaPlaceholderPath: undefined,
				latestLemmaResult: {
					attestation: {
						source: {
							ref: "![[Src#^3|^]]",
							textRaw: "Das ist eine Redensart.",
							textWithOnlyTargetMarked: "Das ist eine [Redensart].",
						},
						target: { surface: "Redensart" },
					},
					disambiguationResult: { matchedIndex: 1 },
					lemma: "redensart",
					linguisticUnit: "Phrasem",
					posLikeKind: "Idiom",
					surfaceKind: "Lemma",
				},
				latestLemmaTargetOwnedByInvocation: false,
				latestResolvedLemmaTargetPath: targetPath,
				lexicalGeneration: {
					generateLexicalInfo: async () => ok(makeProperNounLexicalInfo()),
				} as unknown as LexicalGenerationModule,
				lookupInLibrary: () => [],
				parseLibraryBasename: () => null,
				pendingGenerate: null,
				promptRunner: {
					generate: (kind: string) => {
						promptCalls.push(kind);
						return okAsync("fresh translation");
					},
				},
				vam: {},
			} as unknown as TextfresserState,
		};

		const result = await generateCommand(input);
		expect(result.isOk()).toBe(true);
		if (result.isErr()) return;

		expect(promptCalls).toEqual(["WordTranslation"]);

		const serialized = await extractFinalWrittenContent(result.value);
		expect(serialized).toContain(
			'<span class="entry_section_title entry_section_title_translations">Custom Title</span>\nmanual translation',
		);
		expect(serialized).toContain(
			'<span class="entry_section_title entry_section_title_translations">Übersetzung</span>\nfresh translation',
		);
	});

	it("leaves raw custom-title attestation opaque and adds a new typed attestation section", async () => {
		const targetPath = buildPolicyDestinationPath({
			lemma: "redensart",
			linguisticUnit: "Phrasem",
			posLikeKind: null,
			surfaceKind: "Lemma",
			targetLanguage: "German",
		});
		const content = [
			"redensart ^PH-LM-1",
			"",
			'<span class="entry_section_title entry_section_title_kontexte">Custom Title</span>',
			"![[Other#^2|^]]",
			sectionMarker(DictSectionKind.Relation),
			"= [[nah]]",
			sectionMarker(DictSectionKind.Translation),
			"idiom",
		].join("\n");
		const input = {
			commandContext: {
				activeFile: {
					content,
					splitPath: targetPath,
				},
				selection: null,
			},
			resultingActions: [],
			textfresserState: {
				attestationForLatestNavigated: null,
				inFlightGenerate: null,
				isLibraryLookupAvailable: false,
				languages: { known: "English", target: "German" },
				latestFailedSections: [],
				latestLemmaInvocationCache: null,
				latestLemmaPlaceholderPath: undefined,
				latestLemmaResult: {
					attestation: {
						source: {
							ref: "![[Src#^3|^]]",
							textRaw: "Das ist eine Redensart.",
							textWithOnlyTargetMarked: "Das ist eine [Redensart].",
						},
						target: { surface: "Redensart" },
					},
					disambiguationResult: { matchedIndex: 1 },
					lemma: "redensart",
					linguisticUnit: "Phrasem",
					posLikeKind: "Idiom",
					surfaceKind: "Lemma",
				},
				latestLemmaTargetOwnedByInvocation: false,
				latestResolvedLemmaTargetPath: targetPath,
				lexicalGeneration: {
					generateLexicalInfo: async () => ok(makePhrasemLexicalInfo()),
				} as unknown as LexicalGenerationModule,
				lookupInLibrary: () => [],
				parseLibraryBasename: () => null,
				pendingGenerate: null,
				promptRunner: {
					generate: () => okAsync("unused"),
				},
				vam: {},
			} as unknown as TextfresserState,
		};

		const result = await generateCommand(input);
		expect(result.isOk()).toBe(true);
		if (result.isErr()) return;

		const serialized = await extractFinalWrittenContent(result.value);
		expect(serialized).toContain(
			'<span class="entry_section_title entry_section_title_kontexte">Custom Title</span>\n![[Other#^2|^]]',
		);
		expect(serialized).toContain(
			'<span class="entry_section_title entry_section_title_kontexte">Kontexte</span>\n![[Src#^3|^]]',
		);
		expect(serialized).not.toContain("![[Other#^2|^]]\n\n![[Src#^3|^]]");
	});

	it("canonicalizes existing structured section order before write", async () => {
		const targetPath = buildPolicyDestinationPath({
			lemma: "redensart",
			linguisticUnit: "Phrasem",
			posLikeKind: null,
			surfaceKind: "Lemma",
			targetLanguage: "German",
		});
		const content = [
			"redensart ^PH-LM-1",
			"",
			sectionMarker(DictSectionKind.Translation),
			"idiom",
			sectionMarker(DictSectionKind.Attestation),
			"![[Other#^2|^]]",
			sectionMarker(DictSectionKind.Relation),
			"= [[nah]]",
		].join("\n");
		const input = {
			commandContext: {
				activeFile: {
					content,
					splitPath: targetPath,
				},
				selection: null,
			},
			resultingActions: [],
			textfresserState: {
				attestationForLatestNavigated: null,
				inFlightGenerate: null,
				isLibraryLookupAvailable: false,
				languages: { known: "English", target: "German" },
				latestFailedSections: [],
				latestLemmaInvocationCache: null,
				latestLemmaPlaceholderPath: undefined,
				latestLemmaResult: {
					attestation: {
						source: {
							ref: "![[Src#^3|^]]",
							textRaw: "Das ist eine Redensart.",
							textWithOnlyTargetMarked: "Das ist eine [Redensart].",
						},
						target: { surface: "Redensart" },
					},
					disambiguationResult: { matchedIndex: 1 },
					lemma: "redensart",
					linguisticUnit: "Phrasem",
					posLikeKind: "Idiom",
					surfaceKind: "Lemma",
				},
				latestLemmaTargetOwnedByInvocation: false,
				latestResolvedLemmaTargetPath: targetPath,
				lexicalGeneration: {
					generateLexicalInfo: async () => ok(makePhrasemLexicalInfo()),
				} as unknown as LexicalGenerationModule,
				lookupInLibrary: () => [],
				parseLibraryBasename: () => null,
				pendingGenerate: null,
				promptRunner: {
					generate: () => okAsync("unused"),
				},
				vam: {},
			} as unknown as TextfresserState,
		};

		const result = await generateCommand(input);
		expect(result.isOk()).toBe(true);
		if (result.isErr()) return;

		const serialized = await extractFinalWrittenContent(result.value);
		expect(
			serialized.indexOf('entry_section_title_kontexte">Kontexte'),
		).toBeLessThan(
			serialized.indexOf('entry_section_title_synonyme">Semantische Beziehungen'),
		);
		expect(
			serialized.indexOf('entry_section_title_synonyme">Semantische Beziehungen'),
		).toBeLessThan(
			serialized.indexOf('entry_section_title_translations">Übersetzung'),
		);
	});

	it("preserves mixed typed and manual notes while inserting generated sections before a loose footer", async () => {
		const promptCalls: string[] = [];
		const content = [
			"redensart ^PH-LM-1",
			"",
			sectionMarker(DictSectionKind.Attestation),
			"![[Other#^2|^]]",
			sectionMarker(DictSectionKind.FreeForm),
			"User note [[Haus]]",
			"",
			"Manual footer",
		].join("\n");

		const result = await generateCommand(
			makePhrasemGenerateInput({
				content,
				promptCalls,
			}),
		);
		expect(result.isOk()).toBe(true);
		if (result.isErr()) return;

		expect(promptCalls).toEqual(["WordTranslation"]);

		const serialized = await extractFinalWrittenContent(result.value);
		expect(serialized).toContain("User note [[Haus]]");
		expect(
			serialized.indexOf('entry_section_title_translations">Übersetzung'),
		).toBeLessThan(serialized.indexOf('entry_section_title_notizen">Notizen'));
		expect(
			serialized.indexOf('entry_section_title_notizen">Notizen'),
		).toBeLessThan(serialized.indexOf("Manual footer"));
		expect(serialized.indexOf("Manual footer")).toBeGreaterThan(
			serialized.indexOf('entry_section_title_synonyme">Semantische Beziehungen'),
		);
	});

	it("adds a typed translation while preserving duplicate recognized raw translation blocks", async () => {
		const promptCalls: string[] = [];
		const content = [
			"redensart ^PH-LM-1",
			"",
			sectionMarker(DictSectionKind.Attestation),
			"![[Other#^2|^]]",
			sectionMarker(DictSectionKind.Relation),
			"= [[nah]]",
			'<span class="entry_section_title entry_section_title_translations">Custom Title</span>',
			"manual translation",
			sectionMarker(DictSectionKind.Translation),
			"duplicate translation block",
			sectionMarker(DictSectionKind.FreeForm),
			"User note [[Haus]]",
		].join("\n");

		const result = await generateCommand(
			makePhrasemGenerateInput({
				content,
				promptCalls,
			}),
		);
		expect(result.isOk()).toBe(true);
		if (result.isErr()) return;

		expect(promptCalls).toEqual(["WordTranslation"]);

		const serialized = await extractFinalWrittenContent(result.value);
		expect(serialized).toContain(
			'<span class="entry_section_title entry_section_title_translations">Custom Title</span>\nmanual translation',
		);
		expect(serialized).toContain(
			'<span class="entry_section_title entry_section_title_translations">Übersetzung</span>\nduplicate translation block',
		);
		expect(serialized).toContain(
			'<span class="entry_section_title entry_section_title_translations">Übersetzung</span>\nfresh translation',
		);
	});
});
