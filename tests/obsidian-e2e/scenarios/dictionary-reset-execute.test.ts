import { describe, expect, it } from "bun:test";
import { withObsidianScenario } from "../harness";
import {
	CLASSIFY_RESOLUTION_DUMGEN,
	LEMMA_PATHS,
	STORY,
} from "./classify-resolution-script";
import { linkTo } from "./dictionary-layout";

/** The old Hund note: one attestation of the Story's block ^1, and a memo. */
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
		"Mein Hund heißt Bello.",
		"",
	].join("\n"),
	path: "de/lexem/lemma/h/hun/hund/Hund.md",
};

/** The Story as the old notes left it: the user's own link at ^1. */
const OLD_STORY = STORY.replace("Der Hund schläft.", "Der [[Hund]] schläft.");

const READING_PATH = LEMMA_PATHS.hund.replace(/Hund\.md$/u, "🐕 Hund.md");

describe("Obsidian E2E - Dictionary reset Execute", () => {
	// The reset regenerated every word of the user's vault but linked none:
	// the old links the Scrolls held stayed (#148).
	it("regenerates an old note's attestation, replacing the old link at it with the link to its Reading", async () => {
		await withObsidianScenario(
			{
				dictionaryFixture: [OLD_HUND_NOTE],
				dumgen: CLASSIFY_RESOLUTION_DUMGEN,
				fixture: [{ content: OLD_STORY, path: "Story.md" }],
				id: "dictionary-reset-execute",
				resetDictionary: true,
			},
			async ({ act, dictionary, snapshot, status }) => {
				await act({ execute: true, kind: "dryRunDictionaryReset" });

				const run = (await status()).dictionaryResetRun;
				expect(run?.dryRun.kind).toBe("Report");
				expect(run?.execute).toMatchObject({
					cancelled: false,
					kind: "Done",
				});

				const story = (await snapshot()).markdown["Story.md"] ?? "";
				expect(story).toContain(
					`\n\n${linkTo(READING_PATH, "Der Hund")} schläft. ^1`,
				);
				expect(story).not.toContain("[[Hund]]");

				const notes = (await dictionary()).markdown;
				expect(Object.keys(notes)).toContain(LEMMA_PATHS.hund);
				const reading = notes[READING_PATH] ?? "";
				expect(reading).toMatch(/!\[\[Story#\^1\|\^[0-9a-f]{8}\]\]/u);
				expect(reading).toContain("Mein Hund heißt Bello.");
			},
		);
	});
});
