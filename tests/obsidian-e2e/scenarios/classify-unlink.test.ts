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
	it("removes the occurrence of a link the user deletes from the Scroll, and a Reading no link names any more", async () => {
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
				// Classify attests nothing: a click on a link does (#281).
				expect((await dictionary()).markdown[hund]).not.toMatch(KONTEXT_0);
				await act({ kind: "clickScrollLink", linkpath: linkpath(hund), path: "Story.md" });
				await act({ kind: "clickScrollLink", linkpath: linkpath(heute), path: "Story.md" });
				await act({ kind: "runClassify", path: "Story.md", selection: SECOND_SELECTION });
				await act({ kind: "clickScrollLink", linkpath: linkpath(hund), nth: 1, path: "Story.md" });
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
				// Der Hund keeps the occurrence it is still linked by; the
				// other's embed goes.
				expect(notes[hund]).toMatch(KONTEXT_0);
				expect(notes[hund]).not.toMatch(KONTEXT_1);
				// heute lost its only occurrence and its only link: its
				// Reading and Lemma notes go (#281).
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
				// A click on each link attests its occurrence (#281).
				await act({ kind: "clickScrollLink", linkpath: linkpath(hund), path: "Story.md" });
				await act({ kind: "clickScrollLink", linkpath: linkpath(heute), path: "Story.md" });
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

	it("keeps a Reading another note still links when its Attestation goes, and removes it with that link (#281)", async () => {
		await withObsidianScenario(
			{
				dumgen: CLASSIFY_RESOLUTION_DUMGEN,
				fixture: [{ content: STORY, path: "Story.md" }],
				id: "classify-unlink-linked-elsewhere",
				resetDictionary: true,
			},
			async ({ act, dictionary, snapshot, status }) => {
				await act({ kind: "runClassify", path: "Story.md", selection: FIRST_SELECTION });
				const resolved = (await status()).classify?.resolved ?? [];
				const [, , heute] = resolved.map((unit) => {
					if (!("readingPath" in unit))
						throw new Error(`A unit stayed pending: ${unit.pending}`);
					return unit.readingPath;
				});
				if (!heute) throw new Error("Classify resolved fewer units than it reported");
				await act({ kind: "clickScrollLink", linkpath: linkpath(heute), path: "Story.md" });
				expect((await dictionary()).markdown[heute]).toMatch(KONTEXT_0);
				// The user's own note links heute too.
				const other = `Notiz: ${linkTo(heute, "heute")}\n`;
				await act({ content: other, kind: "createFile", path: "Notiz.md" });

				// The user unlinks heute in the Scroll: its Attestation and embed
				// go at once, and the Reading stays, as Notiz still links it.
				const story = (await snapshot()).markdown["Story.md"] ?? "";
				const unlinked = story.replace(linkTo(heute, "heute"), "heute");
				expect(unlinked).not.toBe(story);
				await act({ content: unlinked, kind: "modifyFile", path: "Story.md" });
				let notes = (await dictionary()).markdown;
				expect(notes[heute]).toBeDefined();
				expect(notes[heute]).not.toMatch(KONTEXT_0);
				expect(notes[LEMMA_PATHS.heute]).toBeDefined();

				// Notiz's link goes too: the Reading and its Lemma go.
				await act({ content: "Notiz: heute\n", kind: "modifyFile", path: "Notiz.md" });
				notes = (await dictionary()).markdown;
				expect(notes[heute]).toBeUndefined();
				expect(notes[LEMMA_PATHS.heute]).toBeUndefined();
				expect(visible(notes[CROSSROAD_PATHS.heute])).toBe(
					`${TITLES.eintraege}\n*Not classified yet*`,
				);
			},
		);
	});

	it("removes a Reading Classify linked and nobody clicked once its last link goes, and when its Scroll is deleted (#281)", async () => {
		await withObsidianScenario(
			{
				dumgen: CLASSIFY_RESOLUTION_DUMGEN,
				fixture: [{ content: STORY, path: "Story.md" }],
				id: "classify-unlink-unclicked",
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
				// Only Der Hund is clicked.
				await act({ kind: "clickScrollLink", linkpath: linkpath(hund), path: "Story.md" });
				let notes = (await dictionary()).markdown;
				expect(notes[heute]).toBeDefined();
				expect(notes[heute]).not.toMatch(KONTEXT_0);

				// heute's link goes: no Attestation and no link hold it.
				const story = (await snapshot()).markdown["Story.md"] ?? "";
				const unlinked = story.replace(linkTo(heute, "heute"), "heute");
				expect(unlinked).not.toBe(story);
				await act({ content: unlinked, kind: "modifyFile", path: "Story.md" });
				notes = (await dictionary()).markdown;
				expect(notes[heute]).toBeUndefined();
				expect(notes[LEMMA_PATHS.heute]).toBeUndefined();
				expect(notes[hund]).toMatch(KONTEXT_0);

				// The Scroll is deleted: the Readings it alone linked and nobody
				// clicked go; Der Hund keeps its Attestation.
				const unclicked = resolved.flatMap((unit) =>
					"readingPath" in unit && unit.readingPath !== hund && unit.readingPath !== heute
						? [unit.readingPath]
						: [],
				);
				await act({ kind: "deletePath", path: "Story.md" });
				notes = (await dictionary()).markdown;
				for (const path of unclicked) expect(notes[path]).toBeUndefined();
				expect(notes[hund]).toMatch(KONTEXT_0);
			},
		);
	});
});
