import { describe, expect, it } from "bun:test";
import { withObsidianScenario } from "../harness";
import {
	CLASSIFY_RESOLUTION_DUMGEN,
	CROSSROAD_PATHS,
	FIRST_SELECTION,
	LEMMA_PATHS,
	SECOND_SELECTION,
	STORY,
} from "./classify-resolution-script";
import {
	expectHiddenMetadata,
	linkpath,
	linkTo,
	TITLES,
	visible,
} from "./dictionary-layout";

const KONTEXT_0 = /!\[\[Story#\^0\|\^[0-9a-f]{8}\]\]/u;
const KONTEXT_1 = /!\[\[Story#\^1\|\^[0-9a-f]{8}\]\]/u;
const DICTIONARY_LINK = /\[\[(Worter\/[^\]|\n]+)\|([^\]\n]*)\]\]/gu;

/**
 * The Scroll as Obsidian's link updater writes it with "New link format:
 * shortest path": each dictionary link by its note's name alone, where no
 * other note shares that name, ignoring case.
 */
const shortestLinks = (scroll: string, paths: readonly string[]) =>
	scroll.replace(DICTIONARY_LINK, (whole, path: string, shown: string) => {
		const name = path.split("/").at(-1) ?? path;
		const sharing = paths.filter(
			(other) => other.split("/").at(-1)?.toLowerCase() === `${name.toLowerCase()}.md`,
		);
		return sharing.length === 1 ? `[[${name}|${shown}]]` : whole;
	});

describe("Obsidian E2E - Classify unlink", () => {
	it("removes the occurrence of a link the user deletes from the Scroll, and a Reading with its last one", async () => {
		await withObsidianScenario(
			{
				dumgen: CLASSIFY_RESOLUTION_DUMGEN,
				fixture: [{ content: STORY, path: "Story.md" }],
				id: "classify-unlink",
				resetDictionary: true,
			},
			async ({ act, dictionary, snapshot, status }) => {
				await act({ kind: "runClassify", path: "Story.md", selection: FIRST_SELECTION });
				const resolved = (await status()).classify?.resolved ?? [];
				const [hund, , heute] = resolved.map((unit) => {
					if (!("readingPath" in unit))
						throw new Error(`A unit stayed pending: ${unit.pending}`);
					return unit.readingPath;
				});
				if (!hund || !heute) throw new Error("Classify resolved fewer units than it reported");
				await act({ kind: "runClassify", path: "Story.md", selection: SECOND_SELECTION });
				let notes = (await dictionary()).markdown;
				expect(notes[hund]).toMatch(KONTEXT_0);
				expect(notes[hund]).toMatch(KONTEXT_1);
				expect(notes[heute]).toMatch(KONTEXT_0);

				// The user unlinks the second "Der Hund" and "heute".
				const story = (await snapshot()).markdown["Story.md"] ?? "";
				const unlinked = story
					.replace(`${linkTo(hund, "Der Hund")} schläft.`, "Der Hund schläft.")
					.replace(linkTo(heute, "heute"), "heute");
				expect(unlinked).not.toBe(story);
				await act({ content: unlinked, kind: "modifyFile", path: "Story.md" });

				notes = (await dictionary()).markdown;
				// Der Hund keeps the occurrence it is still linked by.
				expect(notes[hund]).toMatch(KONTEXT_0);
				expect(notes[hund]).not.toMatch(KONTEXT_1);
				// heute lost its only occurrence: its Reading and Lemma notes go.
				expect(notes[heute]).toBeUndefined();
				expect(notes[LEMMA_PATHS.heute]).toBeUndefined();
				expect(notes[LEMMA_PATHS.hund]).toBeDefined();
				// The commit regenerates the Crossroads it touches: heute's says
				// it is not classified yet, and Hund's still lists der Hund.
				expectHiddenMetadata(notes[CROSSROAD_PATHS.heute], "crossroadNote");
				expect(visible(notes[CROSSROAD_PATHS.heute])).toBe(
					`${TITLES.eintraege}\n*Not classified yet*`,
				);
				expect(visible(notes[CROSSROAD_PATHS.hund])).toBe(
					`${TITLES.eintraege}\n- der ${linkTo(LEMMA_PATHS.hund, "Hund")}: ${linkTo(hund, "🐕")}`,
				);
				// The Scroll is left as the user wrote it.
				expect((await snapshot()).markdown["Story.md"]).toBe(unlinked);
			},
		);
	});

	it("keeps the occurrences of links rewritten to the shortest path, and removes them once the user deletes those links (#171)", async () => {
		await withObsidianScenario(
			{
				dumgen: CLASSIFY_RESOLUTION_DUMGEN,
				fixture: [{ content: STORY, path: "Story.md" }],
				id: "classify-unlink-shortest-links",
				resetDictionary: true,
			},
			async ({ act, dictionary, snapshot, status }) => {
				await act({ kind: "runClassify", path: "Story.md", selection: FIRST_SELECTION });
				const resolved = (await status()).classify?.resolved ?? [];
				const [hund, , heute] = resolved.map((unit) => {
					if (!("readingPath" in unit))
						throw new Error(`A unit stayed pending: ${unit.pending}`);
					return unit.readingPath;
				});
				if (!hund || !heute) throw new Error("Classify resolved fewer units than it reported");
				const before = (await dictionary()).markdown;
				expect(before[hund]).toMatch(KONTEXT_0);
				expect(before[heute]).toMatch(KONTEXT_0);

				// Obsidian's link updater rewrites the links to the shortest path.
				const story = (await snapshot()).markdown["Story.md"] ?? "";
				const paths = [...Object.keys(before), "Story.md"];
				const shortest = shortestLinks(story, paths);
				expect(shortest).not.toContain("[[Worter/");
				await act({ content: shortest, kind: "modifyFile", path: "Story.md" });
				expect((await dictionary()).markdown).toEqual(before);

				// The user deletes heute's link: its occurrence, Reading and Lemma go.
				const heuteName = linkpath(heute).split("/").at(-1) ?? heute;
				const withoutHeute = shortest.replace(`[[${heuteName}|heute]]`, "heute");
				expect(withoutHeute).not.toBe(shortest);
				await act({ content: withoutHeute, kind: "modifyFile", path: "Story.md" });
				let notes = (await dictionary()).markdown;
				expect(notes[heute]).toBeUndefined();
				expect(notes[LEMMA_PATHS.heute]).toBeUndefined();
				expect(notes[hund]).toMatch(KONTEXT_0);

				// The user deletes every link left: the Scroll still holds the
				// Sentence they were recorded in, so every occurrence goes.
				await act({ content: STORY, kind: "modifyFile", path: "Story.md" });
				notes = (await dictionary()).markdown;
				expect(notes[hund]).toBeUndefined();
				expect(notes[LEMMA_PATHS.hund]).toBeUndefined();
				expect((await snapshot()).markdown["Story.md"]).toBe(STORY);
			},
		);
	});
});
