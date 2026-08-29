import { describe, expect, it } from "bun:test";
import type {
	SplitPathToMdFile,
} from "@textfresser/vault-action-manager";
import { VaultActionKind } from "@textfresser/vault-action-manager";
import type { VaultActionManager } from "@textfresser/vault-action-manager/facade";
import { Effect, Result } from "effect";
import { errAsync, okAsync } from "neverthrow";
import type { PromptOutput } from "../../../../src/commanders/textfresser/llm/prompt-catalog";
import type { PromptRunner } from "../../../../src/commanders/textfresser/llm/prompt-runner";
import { Textfresser } from "../../../../src/commanders/textfresser/textfresser";
import type { CommandContext } from "../../../../src/managers/obsidian/command-executor";
import type { ApiService } from "../../../../src/stateless-helpers/api-service";

type HarnessOptions = {
	lemma: string;
	disableAutomaticBackgroundGenerate?: boolean;
	finalExists?: boolean;
	lemmaFailuresBeforeSuccess?: number;
	lemmaOutputs?: PromptOutput<"Lemma">[];
	lookupInLibrary?: (surface: string) => SplitPathToMdFile[];
	mdPwd?: SplitPathToMdFile | null;
	placeholderContent?: string;
	readContent?: (splitPath: SplitPathToMdFile) => string | undefined;
};

const SOURCE_PATH: SplitPathToMdFile = {
	basename: "Source",
	extension: "md",
	kind: "MdFile",
	pathParts: ["Books"],
};

function makeHarness(options: HarnessOptions) {
	const dispatches: Array<readonly unknown[]> = [];
	const cdCalls: SplitPathToMdFile[] = [];
	let lemmaFailuresLeft = options.lemmaFailuresBeforeSuccess ?? 0;
	let lemmaCallCount = 0;

	const vam = {
		cd: (splitPath: SplitPathToMdFile) => Effect.sync(() => {
			cdCalls.push(splitPath);
		}),
		dispatch: (actions: readonly unknown[]) => Effect.sync(() => {
			dispatches.push(actions);
		}),
		exists: (splitPath: SplitPathToMdFile) =>
			Effect.succeed(options.finalExists === true && splitPath.basename === options.lemma),
		findByBasename: () => Effect.succeed([]),
		getOpenedContent: () => Effect.succeed(""),
		getSelectionInfo: () => Effect.succeed(null),
		mdPwd: () => Effect.succeed(options.mdPwd ?? null),
		readContent: (splitPath: SplitPathToMdFile) =>
			Effect.succeed(
				options.readContent?.(splitPath) ??
					(splitPath.basename === "geht"
						? options.placeholderContent ?? ""
						: ""),
			),
		resolveLinkpathDest: () => Effect.succeed(null),
		scrollOpenedFileToLine: () => Effect.void,
	} as unknown as VaultActionManager;

	const apiService = {
		generate: async ({ requestLabel }: { requestLabel: string }) => {
			if (requestLabel === "Lemma") {
				if (lemmaFailuresLeft > 0) {
					lemmaFailuresLeft -= 1;
					return errAsync({ reason: "lemma failed" });
				}
				const configuredOutput = options.lemmaOutputs?.[
					Math.min(
						lemmaCallCount,
						Math.max((options.lemmaOutputs?.length ?? 1) - 1, 0),
					)
				];
				lemmaCallCount += 1;

				if (configuredOutput) {
					return okAsync(configuredOutput);
				}

				return okAsync({
					contextWithLinkedParts: "Er [geht] schnell. ^1",
					lemma: options.lemma,
					linguisticUnit: "Lexem",
					posLikeKind: "Verb",
					surfaceKind: "Lemma",
				});
			}

			return okAsync({ matchedIndex: null, senseEmojis: null });
		},
	} as unknown as ApiService;

	const textfresser = new Textfresser(
		vam,
		{ known: "English", target: "German" },
		apiService,
		{ generateInflections: true },
	);
	textfresser.setLibrarianResolvers({
		lookupInLibraryByCoreName: options.lookupInLibrary ?? (() => []),
		parseLibraryBasename: () => null,
	});
	textfresser.getState().promptRunner = {
		generate: (kind: string) => {
			if (kind === "Lemma") {
				if (lemmaFailuresLeft > 0) {
					lemmaFailuresLeft -= 1;
					return errAsync({ reason: "lemma failed" });
				}
				const configuredOutput = options.lemmaOutputs?.[
					Math.min(
						lemmaCallCount,
						Math.max((options.lemmaOutputs?.length ?? 1) - 1, 0),
					)
				];
				lemmaCallCount += 1;

				if (configuredOutput) {
					return okAsync(configuredOutput);
				}

				return okAsync({
					contextWithLinkedParts: "Er [geht] schnell. ^1",
					lemma: options.lemma,
					linguisticUnit: "Lexem",
					posLikeKind: "Verb",
					surfaceKind: "Lemma",
				});
			}
			return okAsync({ matchedIndex: null, senseEmojis: null });
		},
	} as unknown as PromptRunner;

	// Disable automatic background-generate during tests by default.
	if (options.disableAutomaticBackgroundGenerate ?? true) {
		textfresser.getState().inFlightGenerate = {
			lemma: "__inflight__",
			promise: Promise.resolve(),
			targetOwnedByInvocation: false,
			targetPath: SOURCE_PATH,
		};
	}

	return {
		cdCalls,
		dispatches,
		getLemmaCallCount: () => lemmaCallCount,
		textfresser,
	};
}

function buildDictEntryContent(params: {
	entryId: string;
	sectionKinds: string[];
}): string {
	const sectionBlocks = params.sectionKinds
		.map(
			(kind) =>
				`<span class="entry_section_title entry_section_title_${kind}">${kind}</span>\ncontent`,
		)
		.join("\n");
	return `Header ^${params.entryId}\n\n${sectionBlocks}\n`;
}

function makeLemmaContext(): CommandContext {
	return makeLemmaContextFor("Er geht schnell. ^1", "geht");
}

function makeLemmaContextFor(
	rawBlock: string,
	surface: string,
): CommandContext {
	return {
		activeFile: {
			content: `A\n${rawBlock}\nB`,
			splitPath: SOURCE_PATH,
		},
		selection: {
			selectionStartInBlock: rawBlock.indexOf(surface),
			splitPathToFileWithSelection: SOURCE_PATH,
			surroundingRawBlock: rawBlock,
			text: surface,
		},
	};
}

function runLemmaCommand(
	textfresser: Textfresser,
	context: CommandContext,
	notify: (message: string) => void,
) {
	return Effect.runPromise(
		textfresser.executeCommand("Lemma", context, notify).pipe(Effect.result),
	);
}

describe("lemma two-phase flow", () => {
	it("precreates Worter placeholder when selected surface is unresolved", async () => {
		const { dispatches, textfresser } = makeHarness({ lemma: "gehen" });
		const result = await runLemmaCommand(textfresser, makeLemmaContext(), () => {});
		expect(Result.isSuccess(result)).toBe(true);

		const phaseA = dispatches[0];
		expect(phaseA).toBeDefined();
		const upsert = phaseA?.find(
			(action) =>
				(action as { kind?: string }).kind === VaultActionKind.UpsertMdFile,
		) as { payload?: { splitPath?: SplitPathToMdFile } } | undefined;
		expect(upsert?.payload?.splitPath?.basename).toBe("geht");
		expect(upsert?.payload?.splitPath?.pathParts[0]).toBe("Worter");
	});

	it("renames placeholder to final target when lemma differs and final note is missing", async () => {
		const { dispatches, textfresser } = makeHarness({ lemma: "gehen" });
		const result = await runLemmaCommand(textfresser, makeLemmaContext(), () => {});
		expect(Result.isSuccess(result)).toBe(true);

		const phaseB = dispatches[1];
		expect(phaseB).toBeDefined();
		const rename = phaseB?.find(
			(action) =>
				(action as { kind?: string }).kind === VaultActionKind.RenameMdFile,
		) as
			| {
					payload?: {
						from?: SplitPathToMdFile;
						to?: SplitPathToMdFile;
					};
			  }
			| undefined;
		expect(rename?.payload?.from?.basename).toBe("geht");
		expect(rename?.payload?.to?.basename).toBe("gehen");
		expect(textfresser.getState().latestLemmaTargetOwnedByInvocation).toBe(
			true,
		);
	});

	it("synchronizes attestation after semantic resolution", async () => {
		const { textfresser } = makeHarness({ lemma: "gehen" });
		const result = await runLemmaCommand(textfresser, makeLemmaContext(), () => {});
		expect(Result.isSuccess(result)).toBe(true);

		const attestation = textfresser.getState().latestLemmaResult?.attestation;
		expect(attestation?.target.lemma).toBe("gehen");
		expect(attestation?.source.textRaw).toContain("|geht]]");
	});

	it("deletes placeholder only when it is empty and final target already exists", async () => {
		const { dispatches, textfresser } = makeHarness({
			finalExists: true,
			lemma: "gehen",
			placeholderContent: "   ",
		});
		const result = await runLemmaCommand(textfresser, makeLemmaContext(), () => {});
		expect(Result.isSuccess(result)).toBe(true);

		const phaseB = dispatches[1];
		expect(phaseB).toBeDefined();
		const trash = phaseB?.find(
			(action) =>
				(action as { kind?: string }).kind === VaultActionKind.TrashMdFile,
		) as { payload?: { splitPath?: SplitPathToMdFile } } | undefined;
		expect(trash?.payload?.splitPath?.basename).toBe("geht");

		const rename = phaseB?.find(
			(action) =>
				(action as { kind?: string }).kind === VaultActionKind.RenameMdFile,
		);
		expect(rename).toBeUndefined();
		expect(textfresser.getState().latestLemmaTargetOwnedByInvocation).toBe(
			false,
		);
	});

	it("retries Lemma once when guardrail rejects same-surface inflected separable verb", async () => {
		const { getLemmaCallCount, textfresser } = makeHarness({
			lemma: "anfangen",
			lemmaOutputs: [
					{
						contextWithLinkedParts:
							"Du [fängst] morgen mit der Arbeit an. ^1",
						lemma: "fängst",
						linguisticUnit: "Lexem",
						posLikeKind: "Verb",
						surfaceKind: "Inflected",
					},
					{
						contextWithLinkedParts:
							"Du [fängst] morgen mit der Arbeit [an]. ^1",
						lemma: "anfangen",
						linguisticUnit: "Lexem",
						posLikeKind: "Verb",
						surfaceKind: "Inflected",
					},
			],
		});

		const context = makeLemmaContextFor(
			"Du fängst morgen mit der Arbeit an. ^1",
			"fängst",
		);
		const result = await runLemmaCommand(textfresser, context, () => {});

		expect(Result.isSuccess(result)).toBe(true);
		expect(getLemmaCallCount()).toBe(2);
		expect(textfresser.getState().latestLemmaResult?.lemma).toBe(
			"anfangen",
		);
	});

	it("drops mismatched contextWithLinkedParts and keeps original attestation markup", async () => {
		const { textfresser } = makeHarness({
			lemma: "anfangen",
			lemmaOutputs: [
					{
						contextWithLinkedParts:
							"Du [fängst] morgen mit der Arbeit [an] EXTRA",
						lemma: "anfangen",
						linguisticUnit: "Lexem",
						posLikeKind: "Verb",
						surfaceKind: "Inflected",
					},
			],
		});

		const context = makeLemmaContextFor(
			"Du fängst morgen mit der Arbeit an. ^1",
			"fängst",
		);
		const result = await runLemmaCommand(textfresser, context, () => {});

		expect(Result.isSuccess(result)).toBe(true);
		expect(
			textfresser.getState().latestLemmaResult?.attestation.source
				.textWithOnlyTargetMarked,
		).toBe("Du [fängst] morgen mit der Arbeit an.");
	});

	it("navigates to final target when user is currently on placeholder note", async () => {
		const placeholderPath: SplitPathToMdFile = {
			basename: "geht",
			extension: "md",
			kind: "MdFile",
			pathParts: ["Worter", "de", "unknown", "g", "geh", "geht"],
		};
		const { cdCalls, textfresser } = makeHarness({
			lemma: "gehen",
			mdPwd: placeholderPath,
		});
		const result = await runLemmaCommand(textfresser, makeLemmaContext(), () => {});
		expect(Result.isSuccess(result)).toBe(true);
		expect(cdCalls).toHaveLength(1);
		expect(cdCalls[0]?.basename).toBe("gehen");
	});

	it("repeated same-token Lemma call within cooldown does not rerun lemma phases", async () => {
		const { dispatches, textfresser } = makeHarness({ lemma: "gehen" });
		const notify = () => {};

		const first = await runLemmaCommand(textfresser, makeLemmaContext(), notify);
		expect(Result.isSuccess(first)).toBe(true);
		expect(dispatches).toHaveLength(2);

		const second = await runLemmaCommand(textfresser, makeLemmaContext(), notify);
		expect(Result.isSuccess(second)).toBe(true);
		expect(dispatches).toHaveLength(2);
	});

	it("cooldown starts only after a successful Lemma call", async () => {
		const { dispatches, textfresser } = makeHarness({
			lemma: "gehen",
			lemmaFailuresBeforeSuccess: 1,
		});

		const failed = await runLemmaCommand(textfresser, makeLemmaContext(), () => {});
		expect(Result.isFailure(failed)).toBe(true);
		expect(dispatches).toHaveLength(1);

		const succeeded = await runLemmaCommand(textfresser, makeLemmaContext(), () => {});
		expect(Result.isSuccess(succeeded)).toBe(true);
		expect(dispatches).toHaveLength(3);
	});

	it("cache-hit complete path is silent", async () => {
		const notifications: string[] = [];
		const entryId = "LX-LM-VERB-1";
		const completeEntry = buildDictEntryContent({
			entryId,
			sectionKinds: [
				"kontexte",
				"synonyme",
				"morpheme",
				"morphologie",
				"flexion",
				"translations",
				"tags",
			],
		});
		const { dispatches, textfresser } = makeHarness({
			lemma: "gehen",
			readContent: (splitPath) =>
				splitPath.basename === "gehen" ? completeEntry : undefined,
		});

		const first = await runLemmaCommand(
			textfresser,
			makeLemmaContext(),
			(message) => notifications.push(message),
		);
		expect(Result.isSuccess(first)).toBe(true);

		const cache = textfresser.getState().latestLemmaInvocationCache;
		expect(cache).toBeTruthy();
		if (cache) {
			textfresser.getState().latestLemmaInvocationCache = {
				...cache,
				generatedEntryId: entryId,
			};
		}

		const beforeSecond = notifications.length;
		const second = await runLemmaCommand(
			textfresser,
			makeLemmaContext(),
			(message) => notifications.push(message),
		);
		expect(Result.isSuccess(second)).toBe(true);
		expect(notifications.length).toBe(beforeSecond);
		expect(dispatches).toHaveLength(2);
	});
});
