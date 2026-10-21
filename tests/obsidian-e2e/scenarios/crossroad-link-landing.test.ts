import { describe, expect, it } from "bun:test";
import { withObsidianScenario } from "../harness";

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
				expect(markdown[`${CROSSROAD}.md`]).toContain("*Not classified yet*");
			},
		);
	});
});
