import { describe, expect, it } from "bun:test";
import { ok, okAsync, errAsync } from "neverthrow";
import { disambiguateSense } from "../../../../src/commanders/textfresser/commands/lemma/steps/disambiguate-sense";
import type { VaultActionManager } from "../../../../src/managers/obsidian/vault-action-manager";
import type { PromptRunner } from "../../../../src/commanders/textfresser/prompt-runner";
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

function makePromptRunner(matchedIndex: number | null, semantics?: string | null): PromptRunner {
	return {
		generate: () =>
			okAsync({ matchedIndex, semantics: semantics ?? null }),
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
	surfaceKind: "Lemma",
	pos: "Noun",
};

/**
 * Build a minimal note with entries for testing.
 * Each entry has: header line with ^blockId, optional semantics section, metadata.
 */
function buildNoteContent(
	entries: Array<{
		id: string;
		semantics?: string;
	}>,
): string {
	const entryBlocks = entries.map((e) => {
		const header = `[[Bank]] ^${e.id}`;
		const sectionPart = e.semantics
			? `\n<span class="entry_section_title entry_section_title_semantics">Im Sinne von</span>\n${e.semantics}`
			: "";
		return header + sectionPart;
	});
	const body = entryBlocks.join("\n\n---\n---\n\n");

	const meta: Record<string, { semantics?: string }> = {};
	for (const e of entries) {
		meta[e.id.toUpperCase()] = e.semantics ? { semantics: e.semantics } : {};
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
			{ id: "LX-LM-VERB-1", semantics: "to bank" },
		]);
		const vam = makeVam({ files: [MOCK_SPLIT_PATH], content });
		const runner = makePromptRunner(null);
		const result = await disambiguateSense(vam, runner, API_RESULT_NOUN, "context");
		expect(result.isOk()).toBe(true);
		expect(result._unsafeUnwrap()).toBeNull();
	});

	it("returns matchedIndex when prompt matches existing sense", async () => {
		const content = buildNoteContent([
			{ id: "LX-LM-NOUN-1", semantics: "Geldinstitut" },
		]);
		const vam = makeVam({ files: [MOCK_SPLIT_PATH], content });
		const runner = makePromptRunner(1);
		const result = await disambiguateSense(vam, runner, API_RESULT_NOUN, "Ich gehe zur Bank");
		expect(result.isOk()).toBe(true);
		expect(result._unsafeUnwrap()).toEqual({ matchedIndex: 1 });
	});

	it("returns null with precomputedSemantics when prompt says new sense", async () => {
		const content = buildNoteContent([
			{ id: "LX-LM-NOUN-1", semantics: "Geldinstitut" },
		]);
		const vam = makeVam({ files: [MOCK_SPLIT_PATH], content });
		const runner = makePromptRunner(null, "Sitzgelegenheit");
		const result = await disambiguateSense(vam, runner, API_RESULT_NOUN, "Sitz auf der Bank");
		expect(result.isOk()).toBe(true);
		const value = result._unsafeUnwrap();
		expect(value).toEqual({
			matchedIndex: null,
			precomputedSemantics: "Sitzgelegenheit",
		});
	});

	it("bounds-checks matchedIndex — out-of-range treated as new sense", async () => {
		const content = buildNoteContent([
			{ id: "LX-LM-NOUN-1", semantics: "Geldinstitut" },
		]);
		const vam = makeVam({ files: [MOCK_SPLIT_PATH], content });
		// LLM returns matchedIndex 99 — not a valid index
		const runner = makePromptRunner(99, "invalid");
		const result = await disambiguateSense(vam, runner, API_RESULT_NOUN, "context");
		expect(result.isOk()).toBe(true);
		const value = result._unsafeUnwrap();
		// Should be treated as new sense with precomputedSemantics
		expect(value).not.toBeNull();
		expect(value!.matchedIndex).toBeNull();
	});

	it("returns first entry index for V2 legacy (all entries lack semantics)", async () => {
		const content = buildNoteContent([
			{ id: "LX-LM-NOUN-1" },
		]);
		const vam = makeVam({ files: [MOCK_SPLIT_PATH], content });
		const runner = makePromptRunner(null);
		const result = await disambiguateSense(vam, runner, API_RESULT_NOUN, "context");
		expect(result.isOk()).toBe(true);
		// V2 legacy: treat as re-encounter of first match
		const value = result._unsafeUnwrap();
		expect(value).toEqual({ matchedIndex: 1 });
	});

	it("returns error when prompt runner fails", async () => {
		const content = buildNoteContent([
			{ id: "LX-LM-NOUN-1", semantics: "Geldinstitut" },
		]);
		const vam = makeVam({ files: [MOCK_SPLIT_PATH], content });
		const runner = makeFailingPromptRunner();
		const result = await disambiguateSense(vam, runner, API_RESULT_NOUN, "context");
		expect(result.isErr()).toBe(true);
	});

	it("returns null when all entries fail to parse", async () => {
		// Entries with completely invalid IDs
		const body = "[[Bank]] ^invalid-id-format";
		const meta = `<section id="textfresser_meta_keep_me_invisible">\n{"entries":{}}\n</section>`;
		const content = `${body}\n\n${meta}`;
		const vam = makeVam({ files: [MOCK_SPLIT_PATH], content });
		const runner = makePromptRunner(null);
		const result = await disambiguateSense(vam, runner, API_RESULT_NOUN, "context");
		expect(result.isOk()).toBe(true);
		expect(result._unsafeUnwrap()).toBeNull();
	});
});
