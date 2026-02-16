import { describe, expect, it } from "bun:test";
import { ok, okAsync } from "neverthrow";
import type { PromptRunner } from "../../../../src/commanders/textfresser/llm/prompt-runner";
import { Textfresser } from "../../../../src/commanders/textfresser/textfresser";
import type { CommandContext } from "../../../../src/managers/obsidian/command-executor";
import { PayloadKind } from "../../../../src/managers/obsidian/user-event-interceptor/types/payload-base";
import type { VaultActionManager } from "../../../../src/managers/obsidian/vault-action-manager";
import type { SplitPathToMdFile } from "../../../../src/managers/obsidian/vault-action-manager/types/split-path";
import { VaultActionKind } from "../../../../src/managers/obsidian/vault-action-manager/types/vault-action";
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
		activeFileService: {
			getContent: () => ok("line\nentry ^ID-1"),
			scrollToLine: (line: number) => {
				scrollCalls.push(line);
			},
		},
		dispatch: async (actions: readonly unknown[]) => {
			dispatches.push(actions);
			return ok(undefined);
		},
		exists: () => false,
		findByBasename: () => [],
		mdPwd: () => null,
		readContent: async () => ok(""),
		resolveLinkpathDest: () => null,
		selection: { getInfo: () => null },
	} as unknown as VaultActionManager;

	const textfresser = new Textfresser(
		vam,
		{ known: "English", target: "German" },
		{} as ApiService,
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

describe("Textfresser thin orchestrator", () => {
	it("delegates TranslateSelection through action-command map and dispatches actions", async () => {
		const { dispatches, textfresser } = makeHarness();
		textfresser.getState().promptRunner = {
			generate: () => okAsync("Good morning"),
		} as unknown as PromptRunner;

		const result = await textfresser.executeCommand(
			"TranslateSelection",
			makeTranslateContext(),
			() => {},
		);

		expect(result.isOk()).toBe(true);
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
				kind: PayloadKind.WikilinkClicked,
				modifiers: { alt: false, ctrl: false, meta: false, shift: false },
				splitPath: SOURCE_PATH,
				wikiTarget: { alias: "geht", basename: "gehen" },
			},
			{
				app: {} as Parameters<typeof handler.handle>[1]["app"],
				vam: {} as Parameters<typeof handler.handle>[1]["vam"],
			},
		);

		expect(outcome.outcome).toBe("Passthrough");
		const attestation = textfresser.getState().attestationForLatestNavigated;
		expect(attestation?.target.surface).toBe("geht");
		expect(attestation?.source.ref).toBe("![[Source#^1|^]]");
	});
});
