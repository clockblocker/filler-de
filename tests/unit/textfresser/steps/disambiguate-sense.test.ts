import { describe, expect, it } from "bun:test";
import { errAsync, ok, okAsync } from "neverthrow";
import { disambiguateSense } from "../../../../src/commanders/textfresser/commands/lemma/steps/disambiguate-sense";
import type { PromptRunner } from "../../../../src/commanders/textfresser/prompt-runner";
import type { GermanLinguisticUnit } from "../../../../src/linguistics/de";
import type { VaultActionManager } from "../../../../src/managers/obsidian/vault-action-manager";
import type { SplitPathToMdFile } from "../../../../src/managers/obsidian/vault-action-manager/types/split-path";

const MOCK_SPLIT_PATH: SplitPathToMdFile = {
	basename: "Bank",
	extension: "md",
	kind: "MdFile" as const,
	pathParts: ["Worter"],
};

function makeVam(opts: {
	files?: SplitPathToMdFile[];
	content?: string;
}): VaultActionManager {
	return {
		findByBasename: () => opts.files ?? [],
		readContent: () =>
			Promise.resolve(ok(opts.content ?? "")),
	} as unknown as VaultActionManager;
}

function makePromptRunner(
	matchedIndex: number | null,
	emojiDescription?: string[] | null,
	onGenerate?: (input: unknown) => void,
): PromptRunner {
	return {
		generate: (_kind, input) => {
			onGenerate?.(input);
			return okAsync({
				emojiDescription: emojiDescription ?? null,
				matchedIndex,
			});
		},
	} as unknown as PromptRunner;
}

function makeFailingPromptRunner(): PromptRunner {
	return {
		generate: () =>
			errAsync({ reason: "API error" }),
	} as unknown as PromptRunner;
}

const API_RESULT_NOUN = {
	lemma: "Bank",
	linguisticUnit: "Lexem",
	pos: "Noun",
	surfaceKind: "Lemma",
} as const;

const API_RESULT_PHRASEM = {
	lemma: "auf jeden Fall",
	linguisticUnit: "Phrasem",
	phrasemeKind: "DiscourseFormula",
	surfaceKind: "Lemma",
} as const;

/**
 * Build a minimal note with entries for testing.
 * Each entry has: header line with ^blockId, metadata with optional emojiDescription.
 */
function buildNoteContent(
	entries: Array<{
		id: string;
		emojiDescription?: string[];
		linguisticUnit?: GermanLinguisticUnit;
	}>,
): string {
	const entryBlocks = entries.map((e) => {
		const header = `[[Bank]] ^${e.id}`;
		return header;
	});
	const body = entryBlocks.join("\n\n---\n---\n\n");

	const meta: Record<
		string,
		{
			emojiDescription?: string[];
			linguisticUnit?: GermanLinguisticUnit;
		}
	> = {};
	for (const e of entries) {
		const entryMeta: {
			emojiDescription?: string[];
			linguisticUnit?: GermanLinguisticUnit;
		} = {};
		if (e.emojiDescription) entryMeta.emojiDescription = e.emojiDescription;
		if (e.linguisticUnit) entryMeta.linguisticUnit = e.linguisticUnit;
		meta[e.id.toUpperCase()] = entryMeta;
	}

	return `${body}\n\n<section id="textfresser_meta_keep_me_invisible">\n${JSON.stringify({ entries: meta })}\n</section>`;
}

describe("disambiguateSense", () => {
	it("returns null when no files found (first encounter)", async () => {
		const vam = makeVam({ files: [] });
		const runner = makePromptRunner(null);
		const result = await disambiguateSense(vam, runner, API_RESULT_NOUN, "context");
		expect(result.isOk()).toBe(true);
		expect(result._unsafeUnwrap()).toBeNull();
	});

	it("returns null when note exists but has no matching entries", async () => {
		const content = buildNoteContent([
			{ emojiDescription: ["🏦"], id: "LX-LM-VERB-1" },
		]);
		const vam = makeVam({ content, files: [MOCK_SPLIT_PATH] });
		const runner = makePromptRunner(null);
		const result = await disambiguateSense(vam, runner, API_RESULT_NOUN, "context");
		expect(result.isOk()).toBe(true);
		expect(result._unsafeUnwrap()).toBeNull();
	});

	it("returns matchedIndex when prompt matches existing sense", async () => {
		const content = buildNoteContent([
			{ emojiDescription: ["🏦"], id: "LX-LM-NOUN-1" },
		]);
		const vam = makeVam({ content, files: [MOCK_SPLIT_PATH] });
		const runner = makePromptRunner(1);
		const result = await disambiguateSense(vam, runner, API_RESULT_NOUN, "Ich gehe zur Bank");
		expect(result.isOk()).toBe(true);
		expect(result._unsafeUnwrap()).toEqual({ matchedIndex: 1 });
	});

	it("returns null with precomputedEmojiDescription when prompt says new sense", async () => {
		const content = buildNoteContent([
			{ emojiDescription: ["🏦"], id: "LX-LM-NOUN-1" },
		]);
		const vam = makeVam({ content, files: [MOCK_SPLIT_PATH] });
		const runner = makePromptRunner(null, ["🪑", "🌳"]);
		const result = await disambiguateSense(vam, runner, API_RESULT_NOUN, "Sitz auf der Bank");
		expect(result.isOk()).toBe(true);
		const value = result._unsafeUnwrap();
		expect(value).toEqual({
			matchedIndex: null,
			precomputedEmojiDescription: ["🪑", "🌳"],
		});
	});

	it("bounds-checks matchedIndex — out-of-range treated as new sense", async () => {
		const content = buildNoteContent([
			{ emojiDescription: ["🏦"], id: "LX-LM-NOUN-1" },
		]);
		const vam = makeVam({ content, files: [MOCK_SPLIT_PATH] });
		// LLM returns matchedIndex 99 — not a valid index
		const runner = makePromptRunner(99, ["❓"]);
		const result = await disambiguateSense(vam, runner, API_RESULT_NOUN, "context");
		expect(result.isOk()).toBe(true);
		const value = result._unsafeUnwrap();
		// Should be treated as new sense with precomputedEmojiDescription
		expect(value).not.toBeNull();
		expect(value!.matchedIndex).toBeNull();
	});

	it("returns first entry index for V2 legacy (all entries lack emojiDescription)", async () => {
		const content = buildNoteContent([
			{ id: "LX-LM-NOUN-1" },
		]);
		const vam = makeVam({ content, files: [MOCK_SPLIT_PATH] });
		const runner = makePromptRunner(null);
		const result = await disambiguateSense(vam, runner, API_RESULT_NOUN, "context");
		expect(result.isOk()).toBe(true);
		// V2 legacy: treat as re-encounter of first match
		const value = result._unsafeUnwrap();
		expect(value).toEqual({ matchedIndex: 1 });
	});

	it("returns error when prompt runner fails", async () => {
		const content = buildNoteContent([
			{ emojiDescription: ["🏦"], id: "LX-LM-NOUN-1" },
		]);
		const vam = makeVam({ content, files: [MOCK_SPLIT_PATH] });
		const runner = makeFailingPromptRunner();
		const result = await disambiguateSense(vam, runner, API_RESULT_NOUN, "context");
		expect(result.isErr()).toBe(true);
	});

	it("forwards phrasemeKind hint from metadata to disambiguate prompt senses", async () => {
		const content = buildNoteContent([
			{
				emojiDescription: ["✅"],
				id: "PH-LM-1",
				linguisticUnit: {
					kind: "Phrasem",
					surface: {
						features: { phrasemeKind: "DiscourseFormula" },
						lemma: "auf jeden Fall",
						surfaceKind: "Lemma",
					},
				},
			},
		]);
		const vam = makeVam({
			content,
			files: [
				{
					...MOCK_SPLIT_PATH,
					basename: "auf jeden Fall",
				},
			],
		});
		let capturedInput: unknown;
		const runner = makePromptRunner(1, null, (input) => {
			capturedInput = input;
		});
		const result = await disambiguateSense(
			vam,
			runner,
			API_RESULT_PHRASEM,
			"context",
		);
		expect(result.isOk()).toBe(true);
		const inputObj = capturedInput as {
			senses?: Array<{ phrasemeKind?: string }>;
		};
		expect(inputObj.senses?.[0]?.phrasemeKind).toBe("DiscourseFormula");
	});

	it("returns null when all entries fail to parse", async () => {
		// Entries with completely invalid IDs
		const body = "[[Bank]] ^invalid-id-format";
		const meta = `<section id="textfresser_meta_keep_me_invisible">\n{"entries":{}}\n</section>`;
		const content = `${body}\n\n${meta}`;
		const vam = makeVam({ content, files: [MOCK_SPLIT_PATH] });
		const runner = makePromptRunner(null);
		const result = await disambiguateSense(vam, runner, API_RESULT_NOUN, "context");
		expect(result.isOk()).toBe(true);
		expect(result._unsafeUnwrap()).toBeNull();
	});
});
