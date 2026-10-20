import { describe, expect, it } from "bun:test";
import type {
	SplitPathToMdFile,
	VaultActionManager,
} from "@textfresser/vault-action-manager";
import { VaultActionKind } from "@textfresser/vault-action-manager";
import { type Dumgen, InvalidModelOutput } from "dumgen";
import { Effect, Result } from "effect";
import { neighbourSentences } from "../../../src/commanders/textfresser/commands/translate/neighbour-sentences";
import { Textfresser } from "../../../src/commanders/textfresser/textfresser";
import {
	createRequestUrlFetch,
	DumgenHost,
} from "../../../src/managers/dumgen";
import type { CommandContext } from "../../../src/managers/obsidian/command-executor";
import type { LanguagesConfig } from "../../../src/types";
import {
	parsedBody,
	responsesBody,
	stubRequestUrl,
} from "../dumgen/request-url-stub";
import { stubDumgen } from "./helpers/stub-dumgen";

const SOURCE_PATH: SplitPathToMdFile = {
	basename: "Source",
	extension: "md",
	kind: "MdFile",
	pathParts: ["Books"],
};

const NOTE = [
	"---",
	"status: NotStarted",
	"---",
	"Es war einmal ein König. ^1",
	"",
	"Er hatte drei [[Tochter|Töchter]]. Die jüngste war die schönste. ^2",
	"",
	"Eines Tages ging sie in den Wald. ^3",
	"",
].join("\n");

const BLOCK_2 =
	"Er hatte drei [[Tochter|Töchter]]. Die jüngste war die schönste. ^2";

function contextFor(
	selection: { text: string | null; startInBlock: number | null } | null,
	block = BLOCK_2,
	content = NOTE,
): CommandContext {
	return {
		activeFile: { content, splitPath: SOURCE_PATH },
		selection: selection && {
			selectionStartInBlock: selection.startInBlock,
			splitPathToFileWithSelection: SOURCE_PATH,
			surroundingRawBlock: block,
			text: selection.text,
		},
	};
}

function harness(
	getDumgen: () => Dumgen,
	languages: LanguagesConfig = { known: "English", target: "German" },
) {
	const dispatches: Array<readonly unknown[]> = [];
	const notices: string[] = [];
	const vam = {
		dispatch: (actions: readonly unknown[]) =>
			Effect.sync(() => {
				dispatches.push(actions);
			}),
	} as unknown as VaultActionManager;
	const textfresser = new Textfresser(
		vam,
		languages,
		getDumgen,
	);
	const translate = (context: CommandContext) =>
		Effect.runPromise(
			textfresser
				.executeCommand("TranslateSelection", context, (message) =>
					notices.push(message),
				)
				.pipe(Effect.result),
		);
	return { dispatches, notices, translate };
}

const firstPayload = (dispatches: Array<readonly unknown[]>) =>
	(dispatches[0]?.[0] as { kind: string; payload: Record<string, unknown> })
		?.payload;

describe("Translate through dumgen", () => {
	it("translates the selection into the known language and writes it under it", async () => {
		const stub = stubDumgen(() => Effect.succeed("He had three daughters."));
		const { dispatches, notices, translate } = harness(() => stub.dumgen);
		const selected = "Er hatte drei [[Tochter|Töchter]].";

		const result = await translate(
			contextFor({ startInBlock: 0, text: selected }),
		);

		expect(Result.isSuccess(result)).toBe(true);
		expect(notices).toEqual([]);
		expect(stub.inputs).toEqual([
			{
				into: "en",
				language: "de",
				neighbours: {
					after: "Die jüngste war die schönste.",
					before: "Es war einmal ein König.",
				},
				sentence: "Er hatte drei Töchter.",
			},
		]);
		expect(dispatches).toHaveLength(1);
		expect((dispatches[0]?.[0] as { kind: string }).kind).toBe(
			VaultActionKind.ProcessMdFile,
		);
		expect(firstPayload(dispatches)).toEqual({
			after: `${selected}\nHe had three daughters.`,
			before: selected,
			splitPath: SOURCE_PATH,
		});
	});

	it("translates the caret's whole block, keeping its block ID, with the neighbouring blocks as context", async () => {
		const stub = stubDumgen(() =>
			Effect.succeed(
				"Он имел трёх дочерей. Младшая была самой красивой.",
			),
		);
		const { dispatches, translate } = harness(() => stub.dumgen, {
			known: "Russian",
			target: "German",
		});

		await translate(contextFor({ startInBlock: null, text: null }));

		expect(stub.inputs[0]).toEqual({
			into: "ru",
			language: "de",
			neighbours: {
				after: "Eines Tages ging sie in den Wald.",
				before: "Es war einmal ein König.",
			},
			sentence: "Er hatte drei Töchter. Die jüngste war die schönste.",
		});
		expect(firstPayload(dispatches)).toEqual({
			after: `${BLOCK_2}\n\nОн имел трёх дочерей. Младшая была самой красивой.`,
			before: BLOCK_2,
			splitPath: SOURCE_PATH,
		});
	});

	it("sends the request through the plugin's dumgen transport", async () => {
		const stub = stubRequestUrl(() => ({
			status: 200,
			text: responsesBody("Once upon a time there was a king."),
		}));
		const host = new DumgenHost({
			fetch: createRequestUrlFetch(stub.requestUrl),
			keys: () => ({ openaiApiKey: "sk-test", typesafeApiKey: "" }),
		});
		const { dispatches, notices, translate } = harness(() => host.get());
		const block = "Es war einmal ein König. ^1";

		await translate(contextFor({ startInBlock: null, text: null }, block));

		expect(notices).toEqual([]);
		expect(stub.requests).toHaveLength(1);
		expect(JSON.stringify(parsedBody(stub.requests[0]))).toContain(
			"Er hatte drei Töchter.",
		);
		expect(firstPayload(dispatches)?.after).toBe(
			`${block}\n\nOnce upon a time there was a king.`,
		);
	});

	it("shows a notice naming the missing OpenAI key and writes nothing", async () => {
		const stub = stubRequestUrl(() => "never");
		const host = new DumgenHost({
			fetch: createRequestUrlFetch(stub.requestUrl),
			keys: () => ({ openaiApiKey: "  ", typesafeApiKey: "ts-key" }),
		});
		const { dispatches, notices, translate } = harness(() => host.get());

		const result = await translate(
			contextFor({ startInBlock: 0, text: "Er hatte drei Töchter." }),
		);

		expect(Result.isFailure(result)).toBe(true);
		expect(stub.requests).toHaveLength(0);
		expect(dispatches).toHaveLength(0);
		expect(notices).toEqual([
			"⚠ Translation failed: Textfresser has no OpenAI API key. Add one in the plugin's settings.",
		]);
	});

	it("shows a notice for an answer dumgen cannot use", async () => {
		const stub = stubDumgen(() =>
			Effect.fail(
				new InvalidModelOutput({
					message: "Luna answered no translation: null",
					stage: "translation",
				}),
			),
		);
		const { dispatches, notices, translate } = harness(() => stub.dumgen);

		await translate(contextFor({ startInBlock: null, text: null }));

		expect(dispatches).toHaveLength(0);
		expect(notices).toEqual([
			"⚠ Translation failed: Luna answered no translation: null",
		]);
	});

	it("shows a notice once dumgen is disposed", async () => {
		const host = new DumgenHost({
			fetch: createRequestUrlFetch(stubRequestUrl(() => "never").requestUrl),
			keys: () => ({ openaiApiKey: "sk-test", typesafeApiKey: "" }),
		});
		host.dispose();
		const { dispatches, notices, translate } = harness(() => host.get());

		await translate(contextFor({ startInBlock: null, text: null }));

		expect(dispatches).toHaveLength(0);
		expect(notices).toEqual([
			"⚠ Translation failed: dumgen was disposed when the plugin unloaded",
		]);
	});

	it("shows a notice when dumgen dies on its input", async () => {
		const stub = stubDumgen(() => Effect.die(new Error("bad input")));
		const { dispatches, notices, translate } = harness(() => stub.dumgen);

		const result = await translate(
			contextFor({ startInBlock: null, text: null }),
		);

		expect(Result.isFailure(result)).toBe(true);
		expect(dispatches).toHaveLength(0);
		expect(notices).toEqual(["⚠ Translation failed: bad input"]);
	});

	it("refuses a text that is not German without asking dumgen", async () => {
		const stub = stubDumgen(() => Effect.succeed("unused"));
		const { dispatches, notices, translate } = harness(() => stub.dumgen, {
			known: "Russian",
			target: "English",
		});

		await translate(contextFor({ startInBlock: null, text: null }));

		expect(stub.inputs).toHaveLength(0);
		expect(dispatches).toHaveLength(0);
		expect(notices).toEqual(["⚠ Translate reads German texts only"]);
	});

	it("refuses a selection with nothing to translate", async () => {
		const stub = stubDumgen(() => Effect.succeed("unused"));
		const { dispatches, translate } = harness(() => stub.dumgen);

		const blank = await translate(
			contextFor({ startInBlock: 0, text: "^2" }, "^2"),
		);
		const none = await translate(contextFor(null));

		for (const result of [blank, none]) {
			expect(Result.isFailure(result)).toBe(true);
			if (Result.isFailure(result))
				expect(result.failure.kind).toBe("NoSelection");
		}
		expect(stub.inputs).toHaveLength(0);
		expect(dispatches).toHaveLength(0);
	});
});

describe("neighbourSentences", () => {
	it("gives the rest of the Sentence around a selection inside it", () => {
		expect(
			neighbourSentences({
				block: BLOCK_2,
				content: NOTE,
				selection: "drei",
				selectionStartInBlock: BLOCK_2.indexOf("drei"),
			}),
		).toEqual({
			after: "Töchter.",
			before: "Er hatte",
		});
	});

	it("finds a selection spanning blocks by its text", () => {
		const selection = "schönste. ^2\n\nEines Tages";
		expect(
			neighbourSentences({
				block: "Eines Tages ging sie in den Wald. ^3",
				content: NOTE,
				selection,
				// The selection starts on an earlier line than the caret's.
				selectionStartInBlock: -14,
			}),
		).toEqual({
			after: "ging sie in den Wald.",
			before: "Die jüngste war die",
		});
	});

	it("tells a repeated word apart by where the selection starts", () => {
		const block = "Er kam. Er ging. ^1";
		const content = `${block}\n\nDann schlief er. ^2\n`;
		const around = (selectionStartInBlock: number) =>
			neighbourSentences({
				block,
				content,
				selection: "Er",
				selectionStartInBlock,
			});
		expect(around(0)).toEqual({ after: "kam." });
		expect(around(block.lastIndexOf("Er"))).toEqual({
			after: "ging.",
			before: "Er kam.",
		});
	});

	it("leaves no half of a link or a bold run the selection starts in", () => {
		const content =
			"Er hatte drei [[Tochter|Töchter]]. ^1\n\nDie jüngste war die **schönste**. ^2\n";
		expect(
			neighbourSentences({
				block: "Er hatte drei [[Tochter|Töchter]]. ^1",
				content,
				selection: "Töchter",
				selectionStartInBlock: "Er hatte drei [[Tochter|".length,
			}),
		).toEqual({ after: "Die jüngste war die schönste.", before: "Er hatte drei" });
		expect(
			neighbourSentences({
				block: "Die jüngste war die **schönste**. ^2",
				content,
				selection: "schönste",
				selectionStartInBlock: "Die jüngste war die **".length,
			}),
		).toEqual({ before: "Die jüngste war die" });
	});

	it("skips the translations written under earlier blocks", () => {
		const content = [
			"Es war einmal ein König. ^1",
			"",
			"Once upon a time there was a king.",
			"",
			"Er hatte drei Töchter. ^2",
			"",
			"He had three daughters.",
			"",
			"Eines Tages ging sie in den Wald. ^3",
		].join("\n");
		expect(
			neighbourSentences({
				block: "Er hatte drei Töchter. ^2",
				content,
				selection: null,
				selectionStartInBlock: null,
			}),
		).toEqual({
			after: "Eines Tages ging sie in den Wald.",
			before: "Es war einmal ein König.",
		});
	});

	it("leaves out the note's metadata and the first and last block's missing side", () => {
		const content = `${NOTE}\n<section id="textfresser_meta_keep_me_invisible">{"status":"Done"}</section>\n`;
		expect(
			neighbourSentences({
				block: "Es war einmal ein König. ^1",
				content,
				selection: null,
				selectionStartInBlock: null,
			}),
		).toEqual({ after: "Er hatte drei Töchter." });
		expect(
			neighbourSentences({
				block: "Eines Tages ging sie in den Wald. ^3",
				content,
				selection: null,
				selectionStartInBlock: null,
			}),
		).toEqual({ before: "Die jüngste war die schönste." });
	});

	it("gives none when the text stands in the note more than once", () => {
		const content = "Ja. ^1\n\nNein. ^2\n\nJa. ^1\n";
		expect(
			neighbourSentences({
				block: "Ja. ^1",
				content,
				selection: null,
				selectionStartInBlock: null,
			}),
		).toEqual({});
	});
});
