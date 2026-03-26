import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { VaultActionKind } from "@textfresser/vault-action-manager/types/vault-action";
import { ok, okAsync } from "neverthrow";
import { generateCommand } from "../../../../src/commanders/textfresser/commands/generate/generate-command";
import { buildPolicyDestinationPath } from "../../../../src/commanders/textfresser/common/lemma-link-routing";
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
			writeAction.kind !== VaultActionKind.ProcessMdFile ||
			!("transform" in writeAction.payload)
		) {
			throw new Error("expected final ProcessMdFile write action");
		}

		const serialized = await writeAction.payload.transform("");
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
});
