import { describe, expect, it } from "bun:test";
import { withObsidianScenario } from "../harness";
import {
	CLASSIFY_RESOLUTION_DUMGEN,
	LEMMA_PATHS,
	STORY,
} from "./classify-resolution-script";

/** The user's memo: paragraphs two and three blank lines apart, links and brackets in them. */
const MEMO = [
	"I [walked] in the park",
	"",
	"",
	"✋ 👀 schloss",
	"schloss (2)",
	"",
	"",
	"",
	"der [[See]]",
	"die [[See]]",
].join("\n");

/** The old Hund note: one attestation of the Story's block ^1, and the memo. */
const OLD_HUND_NOTE = {
	content: [
		"🐕 der [[Hund]], [hʊnt](https://youglish.com/pronounce/Hund/german) ^LX-LM-NOUN-1",
		"",
		'<span class="entry_section_title entry_section_title_kontexte">Kontexte</span>',
		"![[Story#^1|^]]",
		"",
		'<span class="entry_section_title entry_section_title_translations">Übersetzung</span>',
		"dog",
		"",
		"",
		MEMO,
		"",
	].join("\n"),
	path: "de/lexem/lemma/h/hun/hund/Hund.md",
};

const READING_PATH = LEMMA_PATHS.hund.replace(/Hund\.md$/u, "🐕 Hund.md");

describe("Obsidian E2E - Dictionary reset freeform text", () => {
	// The reset refused the user's aufpassen memo, whose paragraphs stand
	// blank lines apart, after the dry run had counted it re-attached (#149).
	it("re-attaches a memo whose paragraphs stand blank lines apart, as it was, to the Reading note", async () => {
		await withObsidianScenario(
			{
				dictionaryFixture: [OLD_HUND_NOTE],
				dumgen: CLASSIFY_RESOLUTION_DUMGEN,
				fixture: [{ content: STORY, path: "Story.md" }],
				id: "dictionary-reset-freeform",
				resetDictionary: true,
			},
			async ({ act, dictionary, status }) => {
				await act({ execute: true, kind: "dryRunDictionaryReset" });

				const run = (await status()).dictionaryResetRun;
				expect(run?.dryRun.kind).toBe("Report");
				expect(run?.execute).toMatchObject({
					cancelled: false,
					kind: "Done",
				});

				const reading = (await dictionary()).markdown[READING_PATH] ?? "";
				expect(reading).toMatch(/!\[\[Story#\^1\|\^[0-9a-f]{8}\]\]/u);
				expect(reading).toContain(`${MEMO}\n`);
			},
		);
	});
});
