import { describe, expect, it } from "bun:test";
import { LexicalGenerationFailureKind } from "@textfresser/lexical-generation";
import { UserEventKind } from "@textfresser/obsidian-event-layer";
import type { SplitPathToMdFile, VaultActionManager } from "@textfresser/vault-action-manager";
import { VaultActionKind } from "@textfresser/vault-action-manager";
import { Effect, Result } from "effect";
import { okAsync } from "neverthrow";
import type { PromptRunner } from "../../../../src/commanders/textfresser/llm/prompt-runner";
import { Textfresser } from "../../../../src/commanders/textfresser/textfresser";
import type { CommandContext } from "../../../../src/managers/obsidian/command-executor";
import type { ApiService } from "../../../../src/stateless-helpers/api-service";

const SOURCE_PATH: SplitPathToMdFile = {
	basename: "Source",
	extension: "md",
	kind: "MdFile",
	pathParts: ["Books"],
};

function makeHarness() {
	const dispatches: Array<readonly unknown[]> = [];
	const scrollCalls: number[] = [];
	const vam = {
		dispatch: (actions: readonly unknown[]) => Effect.sync(() => {
			dispatches.push(actions);
		}),
		exists: () => Effect.succeed(false),
		findByBasename: () => Effect.succeed([]),
		getOpenedContent: () => Effect.succeed("line\nentry ^ID-1"),
		getSelectionInfo: () => Effect.succeed(null),
		mdPwd: () => Effect.succeed(null),
		readContent: () => Effect.succeed(""),
		resolveLinkpathDest: () => Effect.succeed(null),
		scrollOpenedFileToLine: (line: number) =>
			Effect.sync(() => {
				scrollCalls.push(line);
			}),
	} as unknown as VaultActionManager;

	const textfresser = new Textfresser(
		vam,
		{ known: "English", target: "German" },
		{} as ApiService,
		{ generateInflections: true },
	);

	return { dispatches, scrollCalls, textfresser };
}

function makeTranslateContext(): CommandContext {
	return {
		activeFile: {
			content: "line",
			splitPath: SOURCE_PATH,
		},
		selection: {
			selectionStartInBlock: 0,
			splitPathToFileWithSelection: SOURCE_PATH,
			surroundingRawBlock: "Guten Morgen",
			text: "Guten Morgen",
		},
	};
}

function makeGenerateContext(): CommandContext {
	return {
		activeFile: {
			content: "line",
			splitPath: SOURCE_PATH,
		},
		selection: null,
	};
}

describe("Textfresser thin orchestrator", () => {
	it("delegates TranslateSelection through action-command map and dispatches actions", async () => {
		const { dispatches, textfresser } = makeHarness();
		textfresser.getState().promptRunner = {
			generate: () => okAsync("Good morning"),
		} as unknown as PromptRunner;

		const result = await Effect.runPromise(textfresser.executeCommand(
			"TranslateSelection",
			makeTranslateContext(),
			() => {},
		).pipe(Effect.result));

		expect(Result.isSuccess(result)).toBe(true);
		expect(dispatches).toHaveLength(1);
		const actions = dispatches[0] as Array<{ kind?: string }> | undefined;
		expect(actions?.[0]?.kind).toBe(VaultActionKind.ProcessMdFile);
	});

	it("createHandler tracks attestation context from wikilink click payload", async () => {
		const { textfresser } = makeHarness();
		const handler = textfresser.createHandler();

		const outcome = await handler.handle(
			{
				blockContent: "Er sieht [[gehen|geht]] schnell. ^1",
				kind: UserEventKind.WikilinkClicked,
				sourcePath: "Books/Source.md",
				target: { alias: "geht", basename: "gehen" },
			},
		);

		expect(outcome.outcome).toBe("passthrough");
		const attestation = textfresser.getState().attestationForLatestNavigated;
		expect(attestation?.target.surface).toBe("geht");
		expect(attestation?.source.ref).toBe("![[Source#^1|^]]");
	});

	it("fails Lemma immediately when lexical generation init is unsupported", async () => {
		const notifications: string[] = [];
		const { dispatches, textfresser } = makeHarness();
		textfresser.getState().lexicalGeneration = null;
		textfresser.getState().lexicalGenerationInitError = {
			details: { knownLang: "Russian", targetLang: "English" },
			kind: LexicalGenerationFailureKind.UnsupportedLanguagePair,
			message: "Unsupported language pair: English -> Russian",
		};

		const result = await Effect.runPromise(textfresser.executeCommand(
			"Lemma",
			makeTranslateContext(),
			(message) => notifications.push(message),
		).pipe(Effect.result));

		expect(Result.isFailure(result)).toBe(true);
		expect(dispatches).toHaveLength(0);
		if (Result.isFailure(result)) {
			expect("reason" in result.failure && result.failure.reason).toContain(
				"Unsupported language pair",
			);
		}
		expect(notifications[0]).toContain("Unsupported language pair");
	});

	it("fails Generate immediately when lexical generation init is unsupported", async () => {
		const notifications: string[] = [];
		const { dispatches, textfresser } = makeHarness();
		textfresser.getState().lexicalGeneration = null;
		textfresser.getState().lexicalGenerationInitError = {
			details: { knownLang: "Russian", targetLang: "English" },
			kind: LexicalGenerationFailureKind.UnsupportedLanguagePair,
			message: "Unsupported language pair: English -> Russian",
		};

		const result = await Effect.runPromise(textfresser.executeCommand(
			"Generate",
			makeGenerateContext(),
			(message) => notifications.push(message),
		).pipe(Effect.result));

		expect(Result.isFailure(result)).toBe(true);
		expect(dispatches).toHaveLength(0);
		expect(notifications[0]).toContain("Unsupported language pair");
	});
});
