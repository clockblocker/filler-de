import { describe, expect, it } from "bun:test";
import { errAsync, ok, okAsync } from "neverthrow";
import { commandFnForCommandKind } from "../../../../src/commanders/textfresser/commands";
import type { PromptRunner } from "../../../../src/commanders/textfresser/llm/prompt-runner";
import { Textfresser } from "../../../../src/commanders/textfresser/textfresser";
import type { CommandContext } from "../../../../src/managers/obsidian/command-executor";
import type { VaultActionManager } from "../../../../src/managers/obsidian/vault-action-manager";
import type {
	SplitPathToMdFile,
} from "../../../../src/managers/obsidian/vault-action-manager/types/split-path";
import { VaultActionKind } from "../../../../src/managers/obsidian/vault-action-manager/types/vault-action";
import type { ApiService } from "../../../../src/stateless-helpers/api-service";

type HarnessOptions = {
	lemma: string;
	disableAutomaticBackgroundGenerate?: boolean;
	finalExists?: boolean;
	lemmaFailuresBeforeSuccess?: number;
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

function buildTargetPath(basename: string): SplitPathToMdFile {
	return {
		basename,
		extension: "md",
		kind: "MdFile",
		pathParts: ["Worter", "de", "lexem", "lemma"],
	};
}

function setLatestLemmaState(
	textfresser: Textfresser,
	lemma: string,
	targetPath: SplitPathToMdFile,
): void {
	textfresser.getState().latestLemmaResult = {
		attestation: {
			source: {
				path: SOURCE_PATH,
				ref: "![[Source#^1|^]]",
				textRaw: "Er geht schnell. ^1",
				textWithOnlyTargetMarked: "Er [geht] schnell. ^1",
			},
			target: {
				offsetInBlock: 3,
				surface: "geht",
			},
		},
		disambiguationResult: null,
		lemma,
		linguisticUnit: "Lexem",
		posLikeKind: "Verb",
		surfaceKind: "Lemma",
	};
	textfresser.getState().latestResolvedLemmaTargetPath = targetPath;
}

type TextfresserPrivate = {
	fireBackgroundGenerate: (notify: (message: string) => void) => void;
	runBackgroundGenerate: (
		targetPath: SplitPathToMdFile,
		lemma: string,
		notify: (message: string) => void,
	) => Promise<void>;
};

function makeHarness(options: HarnessOptions) {
	const dispatches: Array<readonly unknown[]> = [];
	const cdCalls: SplitPathToMdFile[] = [];
	let lemmaFailuresLeft = options.lemmaFailuresBeforeSuccess ?? 0;

	const vam = {
		activeFileService: {
			getContent: () => ok(""),
			scrollToLine: () => {},
		},
		cd: async (splitPath: SplitPathToMdFile) => {
			cdCalls.push(splitPath);
			return ok(undefined);
		},
		dispatch: async (actions: readonly unknown[]) => {
			dispatches.push(actions);
			return ok(undefined);
		},
		exists: (splitPath: SplitPathToMdFile) =>
			options.finalExists === true && splitPath.basename === options.lemma,
		findByBasename: () => [],
		mdPwd: () => options.mdPwd ?? null,
		readContent: async (splitPath: SplitPathToMdFile) =>
			ok(
				options.readContent?.(splitPath) ??
					(splitPath.basename === "geht"
						? options.placeholderContent ?? ""
						: ""),
			),
		resolveLinkpathDest: () => null,
		selection: { getInfo: () => null },
	} as unknown as VaultActionManager;

	const textfresser = new Textfresser(
		vam,
		{ known: "English", target: "German" },
		{} as ApiService,
	);
	textfresser.setLibrarianLookup(options.lookupInLibrary ?? (() => []));
	textfresser.getState().promptRunner = {
		generate: (kind) => {
			if (kind === "Lemma") {
				if (lemmaFailuresLeft > 0) {
					lemmaFailuresLeft -= 1;
					return errAsync({ reason: "lemma failed" });
				}

				return okAsync({
					lemma: options.lemma,
					linguisticUnit: "Lexem",
					posLikeKind: "Verb",
					surfaceKind: "Lemma",
				});
			}
			return okAsync({ emojiDescription: null, matchedIndex: null });
		},
	} as unknown as PromptRunner;

	// Disable automatic background-generate during tests by default.
	if (options.disableAutomaticBackgroundGenerate ?? true) {
		textfresser.getState().inFlightGenerate = {
			lemma: "__inflight__",
			promise: Promise.resolve(),
			targetPath: SOURCE_PATH,
		};
	}

	return { cdCalls, dispatches, textfresser };
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
	const rawBlock = "Er geht schnell. ^1";
	return {
		activeFile: {
			content: `A\n${rawBlock}\nB`,
			splitPath: SOURCE_PATH,
		},
		selection: {
			selectionStartInBlock: rawBlock.indexOf("geht"),
			splitPathToFileWithSelection: SOURCE_PATH,
			surroundingRawBlock: rawBlock,
			text: "geht",
		},
	};
}

describe("lemma two-phase flow", () => {
	it("precreates Worter placeholder when selected surface is unresolved", async () => {
		const { dispatches, textfresser } = makeHarness({ lemma: "gehen" });
		const result = await textfresser.executeCommand(
			"Lemma",
			makeLemmaContext(),
			() => {},
		);
		expect(result.isOk()).toBe(true);

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
		const result = await textfresser.executeCommand(
			"Lemma",
			makeLemmaContext(),
			() => {},
		);
		expect(result.isOk()).toBe(true);

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
	});

	it("deletes placeholder only when it is empty and final target already exists", async () => {
		const { dispatches, textfresser } = makeHarness({
			finalExists: true,
			lemma: "gehen",
			placeholderContent: "   ",
		});
		const result = await textfresser.executeCommand(
			"Lemma",
			makeLemmaContext(),
			() => {},
		);
		expect(result.isOk()).toBe(true);

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
	});

	it("navigates to final target when user is currently on placeholder note", async () => {
		const placeholderPath: SplitPathToMdFile = {
			basename: "geht",
			extension: "md",
			kind: "MdFile",
			pathParts: ["Worter", "de", "lexem", "lemma", "g", "geh", "geht"],
		};
		const { cdCalls, textfresser } = makeHarness({
			lemma: "gehen",
			mdPwd: placeholderPath,
		});
		const result = await textfresser.executeCommand(
			"Lemma",
			makeLemmaContext(),
			() => {},
		);
		expect(result.isOk()).toBe(true);
		expect(cdCalls).toHaveLength(1);
		expect(cdCalls[0]?.basename).toBe("gehen");
	});

	it("repeated same-token Lemma call within cooldown does not rerun lemma phases", async () => {
		const { dispatches, textfresser } = makeHarness({ lemma: "gehen" });
		const notify = () => {};

		const first = await textfresser.executeCommand(
			"Lemma",
			makeLemmaContext(),
			notify,
		);
		expect(first.isOk()).toBe(true);
		expect(dispatches).toHaveLength(2);

		const second = await textfresser.executeCommand(
			"Lemma",
			makeLemmaContext(),
			notify,
		);
		expect(second.isOk()).toBe(true);
		expect(dispatches).toHaveLength(2);
	});

	it("cooldown starts only after a successful Lemma call", async () => {
		const { dispatches, textfresser } = makeHarness({
			lemma: "gehen",
			lemmaFailuresBeforeSuccess: 1,
		});

		const failed = await textfresser.executeCommand(
			"Lemma",
			makeLemmaContext(),
			() => {},
		);
		expect(failed.isErr()).toBe(true);
		expect(dispatches).toHaveLength(1);

		const succeeded = await textfresser.executeCommand(
			"Lemma",
			makeLemmaContext(),
			() => {},
		);
		expect(succeeded.isOk()).toBe(true);
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

		const first = await textfresser.executeCommand(
			"Lemma",
			makeLemmaContext(),
			(message) => notifications.push(message),
		);
		expect(first.isOk()).toBe(true);

		const cache = textfresser.getState().latestLemmaInvocationCache;
		expect(cache).toBeTruthy();
		if (cache) {
			textfresser.getState().latestLemmaInvocationCache = {
				...cache,
				generatedEntryId: entryId,
			};
		}

		const beforeSecond = notifications.length;
		const second = await textfresser.executeCommand(
			"Lemma",
			makeLemmaContext(),
			(message) => notifications.push(message),
		);
		expect(second.isOk()).toBe(true);
		expect(notifications.length).toBe(beforeSecond);
		expect(dispatches).toHaveLength(2);
	});

	it("queues latest background generate while one is in flight", async () => {
		const { textfresser } = makeHarness({
			disableAutomaticBackgroundGenerate: false,
			lemma: "gehen",
		});
		const textfresserPrivate = textfresser as unknown as TextfresserPrivate;

		const launches: string[] = [];
		let resolveFirst: (() => void) | null = null;
		const firstDone = new Promise<void>((resolve) => {
			resolveFirst = resolve;
		});

		textfresserPrivate.runBackgroundGenerate = async (targetPath) => {
			launches.push(targetPath.basename);
			if (launches.length === 1) {
				await firstDone;
			}
		};

		setLatestLemmaState(textfresser, "alpha", buildTargetPath("alpha"));
		textfresserPrivate.fireBackgroundGenerate(() => {});

		setLatestLemmaState(textfresser, "beta", buildTargetPath("beta"));
		textfresserPrivate.fireBackgroundGenerate(() => {});

		setLatestLemmaState(textfresser, "gamma", buildTargetPath("gamma"));
		textfresserPrivate.fireBackgroundGenerate(() => {});

		expect(textfresser.getState().pendingGenerate?.targetPath.basename).toBe(
			"gamma",
		);

		resolveFirst?.();
		await new Promise((resolve) => setTimeout(resolve, 0));

		const remainingInFlight = textfresser.getState().inFlightGenerate;
		if (remainingInFlight) {
			await remainingInFlight.promise;
		}

		expect(launches).toEqual(["alpha", "gamma"]);
		expect(textfresser.getState().inFlightGenerate).toBeNull();
		expect(textfresser.getState().pendingGenerate).toBeNull();
	});

	it("rolls back a brand-new target note when background generate leaves it empty", async () => {
		const { dispatches, textfresser } = makeHarness({
			disableAutomaticBackgroundGenerate: true,
			lemma: "leer",
			readContent: () => "",
		});
		const textfresserPrivate = textfresser as unknown as TextfresserPrivate;

		const originalGenerate = commandFnForCommandKind.Generate;
		commandFnForCommandKind.Generate = () => okAsync([]);

		try {
			const targetPath = buildTargetPath("leer");
			await expect(
				textfresserPrivate.runBackgroundGenerate(
					targetPath,
					"leer",
					() => {},
				),
			).rejects.toThrow("empty target note");
		} finally {
			commandFnForCommandKind.Generate = originalGenerate;
		}

		expect(dispatches).toHaveLength(2);

		const rollbackDispatch = dispatches[1];
		expect(rollbackDispatch).toBeDefined();
		const rollbackAction = rollbackDispatch?.find(
			(action) =>
				(action as { kind?: string }).kind === VaultActionKind.TrashMdFile,
		) as { payload?: { splitPath?: SplitPathToMdFile } } | undefined;
		expect(rollbackAction?.payload?.splitPath?.basename).toBe("leer");
	});
});
