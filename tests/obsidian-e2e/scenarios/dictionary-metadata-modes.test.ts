import { describe, expect, it } from "bun:test";
import { withObsidianScenario } from "../harness";
import {
	CROSSROAD_PATH,
	LEMMA_PATH,
	LICENCE_GROUPS_DUMGEN,
	PARENT_PATH,
	PARENT_SELECTION,
	STORY,
} from "./classify-licence-groups-script";
import { classifyAndClick } from "./click-links";
import {
	type DictionaryNoteKind,
	expectFrontmatterMetadata,
	expectHiddenMetadata,
	expectInOrder,
	linkpath,
	TITLES,
	tableOf,
	visible,
} from "./dictionary-layout";

const KINDS: Readonly<Record<string, DictionaryNoteKind>> = {
	[CROSSROAD_PATH]: "crossroadNote",
	[LEMMA_PATH]: "lemmaNote",
	[PARENT_PATH]: "readingNote",
};

/** Classifies 👩 Mutter and answers the dictionary's notes. */
async function classifyMutter(
	hideMetadata: boolean | undefined,
	id: string,
): Promise<Readonly<Record<string, string>>> {
	return await withObsidianScenario(
		{
			dumgen: LICENCE_GROUPS_DUMGEN,
			fixture: [{ content: STORY, path: "Story.md" }],
			id,
			resetDictionary: true,
			...(hideMetadata === undefined ? {} : { settings: { hideMetadata } }),
		},
		async (scenario) => {
			const { dictionary, status } = scenario;
			// The click attests Die Mutter and asks for its Knowledge (#281).
			await classifyAndClick(scenario, PARENT_SELECTION);
			expect((await status()).classify?.resolved).toEqual([
				{ linked: 1, readingPath: PARENT_PATH },
			]);
			const { markdown } = await dictionary();
			expect(Object.keys(markdown).sort()).toEqual(Object.keys(KINDS).sort());
			return markdown;
		},
	);
}

/** What the user reads is the same in either mode. */
function expectVisibleLayout(notes: Readonly<Record<string, string>>): void {
	const table = tableOf(notes[LEMMA_PATH], "👩");
	expectInOrder(visible(notes[LEMMA_PATH]), [
		"die [[",
		TITLES.flexion,
		"\n👩\n",
		TITLES.begegneteFormen,
	]);
	expectInOrder(visible(notes[PARENT_PATH]), [
		"👩 die [[",
		`${TITLES.deineKontexte}\n![[Story#^0|^`,
		`${TITLES.flexion}\n![[${linkpath(LEMMA_PATH)}#^${table.blockId}|Mutter]]\n`,
	]);
	expect(visible(notes[CROSSROAD_PATH])).toStartWith(`${TITLES.eintraege}\n- die [[`);
}

describe("Obsidian E2E - dictionary metadata modes", () => {
	it("keeps dictionary data in the frontmatter when Hide metadata is off", async () => {
		const notes = await classifyMutter(false, "dictionary-metadata-frontmatter");
		for (const [path, kind] of Object.entries(KINDS))
			expectFrontmatterMetadata(notes[path], kind);
		expectVisibleLayout(notes);
	});

	it("keeps it in the hidden section again once that scenario ends", async () => {
		const notes = await classifyMutter(undefined, "dictionary-metadata-hidden");
		for (const [path, kind] of Object.entries(KINDS))
			expectHiddenMetadata(notes[path], kind);
		expectVisibleLayout(notes);
	});
});
