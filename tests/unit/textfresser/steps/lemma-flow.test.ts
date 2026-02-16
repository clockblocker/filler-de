import { describe, expect, it } from "bun:test";
import { ok, okAsync } from "neverthrow";
import type { PromptRunner } from "../../../../src/commanders/textfresser/llm/prompt-runner";
import { Textfresser } from "../../../../src/commanders/textfresser/textfresser";
import type { ApiService } from "../../../../src/stateless-helpers/api-service";
import { VaultActionKind } from "../../../../src/managers/obsidian/vault-action-manager/types/vault-action";
import type {
	SplitPathToMdFile,
} from "../../../../src/managers/obsidian/vault-action-manager/types/split-path";
import type { VaultActionManager } from "../../../../src/managers/obsidian/vault-action-manager";
import type { CommandContext } from "../../../../src/managers/obsidian/command-executor";

type HarnessOptions = {
	lemma: string;
	finalExists?: boolean;
	lookupInLibrary?: (surface: string) => SplitPathToMdFile[];
	mdPwd?: SplitPathToMdFile | null;
	placeholderContent?: string;
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
				splitPath.basename === "geht"
					? options.placeholderContent ?? ""
					: "",
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

	// Disable automatic background-generate during tests.
	textfresser.getState().inFlightGenerate = {
		lemma: "__inflight__",
		promise: Promise.resolve(),
		targetPath: SOURCE_PATH,
	};

	return { cdCalls, dispatches, textfresser };
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
});
