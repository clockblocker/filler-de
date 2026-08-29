import { describe, expect, it } from "bun:test";
import { withObsidianScenario } from "../harness";

describe("Obsidian E2E - move a Scroll between Sections", () => {
	it("heals its suffix and regenerates both parent codexes", async () => {
		await withObsidianScenario(
			{
				fixture: [
					{ content: "# Berry anchor", path: "Recipe/Pie/Berry/Anchor.md" },
					{ content: "# Fish anchor", path: "Recipe/Pie/Fish/Anchor.md" },
					{
						content: "# CLI moved scroll",
						path: "Recipe/Pie/Berry/MoveByCli-Berry-Pie-Recipe.md",
					},
				],
				id: "move-scroll-between-sections",
			},
			async ({ act, snapshot }) => {
				await act({
					from: "Recipe/Pie/Berry/MoveByCli-Berry-Pie-Recipe.md",
					kind: "renamePath",
					to: "Recipe/Pie/Fish/MoveByCli-Berry-Pie-Recipe.md",
				});

				const vault = await snapshot();
				expect(
					vault.files.some(
						({ path }) => path === "Recipe/Pie/Fish/MoveByCli-Fish-Pie-Recipe.md",
					),
				).toBeTrue();
				expect(
					vault.files.some(({ path }) => path.includes("MoveByCli-Berry-Pie-Recipe")),
				).toBeFalse();
				expect(vault.markdown["Recipe/Pie/Fish/__-Fish-Pie-Recipe.md"]).toContain(
					"[[MoveByCli-Fish-Pie-Recipe|MoveByCli]]",
				);
				expect(
					vault.markdown["Recipe/Pie/Berry/__-Berry-Pie-Recipe.md"],
				).not.toContain("MoveByCli");
			},
		);
	});
});
