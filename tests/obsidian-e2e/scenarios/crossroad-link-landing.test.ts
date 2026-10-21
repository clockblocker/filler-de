import { describe, expect, it } from "bun:test";
import { withObsidianScenario } from "../harness";
import { expectHiddenMetadata, TITLES, visible } from "./dictionary-layout";

const CROSSROAD = "Worter/z/zau/zaube/zauberwürfel";

const findPath = (paths: readonly string[], prefix: string): string => {
	const path = paths.find((candidate) => candidate.startsWith(prefix));
	if (!path) throw new Error(`No healed path starts with ${prefix}`);
	return path;
};

describe("Obsidian E2E - landing hand-wrapped links on Crossroad notes (#115)", () => {
	it("rewrites a wrapped word to its Crossroad path, and a click creates the note there", async () => {
		await withObsidianScenario(
			{
				fixture: [
					{
						content: "Der Zauberwürfel liegt neben der Einkaufsliste.\n",
						path: "Texte/Zauber.md",
					},
					{ content: "Milch, Brot.\n", path: "Notizen/Einkaufsliste.md" },
				],
				id: "crossroad-link-landing",
				resetDictionary: true,
			},
			async ({ act, dictionary, snapshot }) => {
				const before = await snapshot();
				const paths = before.files.map(({ path }) => path);
				const scroll = findPath(paths, "Texte/Zauber");
				const list = findPath(paths, "Notizen/Einkaufsliste");

				// A bare word lands on its Crossroad path, which does not exist yet.
				await act({ kind: "wrapInLink", path: scroll, selection: "Zauberwürfel" });
				let text = (await snapshot()).markdown[scroll] ?? "";
				expect(text).toContain(`Der [[${CROSSROAD}|Zauberwürfel]] liegt`);
				expect(Object.keys((await dictionary()).markdown)).toEqual([]);

				// A word naming a Library note keeps the Library's rules.
				await act({ kind: "wrapInLink", path: scroll, selection: "Einkaufsliste" });
				text = (await snapshot()).markdown[scroll] ?? "";
				const listName = list.split("/").at(-1)?.slice(0, -".md".length);
				expect(text).toContain(`der [[${listName}|Einkaufsliste]].`);

				// A click on the uncreated link creates the note at that exact
				// path, its missing folders included, and the store fills it.
				await act({ kind: "clickLink", linkpath: CROSSROAD, path: scroll });
				const { markdown } = await dictionary();
				expect(Object.keys(markdown)).toEqual([`${CROSSROAD}.md`]);
				expectHiddenMetadata(markdown[`${CROSSROAD}.md`], "crossroadNote");
				expect(visible(markdown[`${CROSSROAD}.md`])).toBe(
					`${TITLES.eintraege}\n*Not classified yet*`,
				);
			},
		);
	});

	it("heals the stray a click on an unresolved bare link makes in Worter/ onto its Crossroad path", async () => {
		await withObsidianScenario(
			{
				// A fixture is written straight to disk, so its bare link was
				// never rewritten, as in a note from before #115.
				fixture: [
					{ content: "Die [[Kaffeekanne]] ist leer.\n", path: "Texte/Kanne.md" },
				],
				id: "crossroad-stray-healing",
				newNotesInDictionary: true,
				resetDictionary: true,
			},
			async ({ act, dictionary, snapshot }) => {
				const scroll = findPath(
					(await snapshot()).files.map(({ path }) => path),
					"Texte/Kanne",
				);
				const before = (await snapshot()).markdown[scroll];

				// Obsidian creates `Worter/Kaffeekanne.md`, where the user's
				// vault puts new notes; the store moves it to its spelling's
				// Crossroad path and fills it as "not classified yet".
				await act({ kind: "clickLink", linkpath: "Kaffeekanne", path: scroll });
				const { markdown } = await dictionary();
				const crossroad = "Worter/k/kaf/kaffe/kaffeekanne.md";
				expect(Object.keys(markdown)).toEqual([crossroad]);
				expectHiddenMetadata(markdown[crossroad], "crossroadNote");
				expect(visible(markdown[crossroad])).toBe(
					`${TITLES.eintraege}\n*Not classified yet*`,
				);
				// The bare link is left as the user wrote it: Obsidian resolves
				// it to the Crossroad note by name.
				expect((await snapshot()).markdown[scroll]).toBe(before);
			},
		);
	});
});
