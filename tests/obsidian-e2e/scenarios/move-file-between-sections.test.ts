import { describe, expect, it } from "bun:test";
import { withObsidianScenario } from "../harness";

describe("Obsidian E2E - move a File between Sections", () => {
	it("heals its suffix and regenerates both parent Codexes", async () => {
		await withObsidianScenario(
			{
				fixture: [
					{ content: "# Berry anchor", path: "Recipe/Pie/Berry/Anchor.md" },
					{ content: "# Fish anchor", path: "Recipe/Pie/Fish/Anchor.md" },
					{
						bytes: [1, 2, 3],
						path: "Recipe/Pie/Berry/Diagram-Berry-Pie-Recipe.png",
					},
				],
				id: "move-file-between-sections",
			},
			async ({ act, snapshot }) => {
				await act({
					from: "Recipe/Pie/Berry/Diagram-Berry-Pie-Recipe.png",
					kind: "renamePath",
					to: "Recipe/Pie/Fish/Diagram-Berry-Pie-Recipe.png",
				});

				const vault = await snapshot();
				expect(vault.files.map(({ path }) => path)).toContain(
					"Recipe/Pie/Fish/Diagram-Fish-Pie-Recipe.png",
				);
				expect(
					vault.files.some(({ path }) => path.includes("Diagram-Berry-Pie-Recipe")),
				).toBeFalse();
				expect(
					vault.markdown["Recipe/Pie/Fish/__-Fish-Pie-Recipe.md"],
				).toContain("[[Diagram-Fish-Pie-Recipe|Diagram]]");
				expect(
					vault.markdown["Recipe/Pie/Berry/__-Berry-Pie-Recipe.md"],
				).not.toContain("Diagram");
			},
		);
	});
});
