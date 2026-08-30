import { describe, expect, it } from "bun:test";
import { withObsidianScenario } from "../harness";

describe("Obsidian E2E - move leaves by Library Suffix", () => {
	it("moves a Scroll and File to the Section encoded in their new names", async () => {
		await withObsidianScenario(
			{
				fixture: [
					{ content: "# Steps", path: "Recipe/Pie/Berry/Steps.md" },
					{ bytes: [1, 2, 3], path: "Recipe/Pie/Berry/Diagram.png" },
					{ content: "# Fish anchor", path: "Recipe/Pie/Fish/Anchor.md" },
				],
				id: "move-leaves-by-name",
			},
			async ({ act, snapshot }) => {
				await act({
					from: "Recipe/Pie/Berry/Steps-Berry-Pie-Recipe.md",
					kind: "renamePath",
					to: "Recipe/Pie/Berry/Steps-Fish-Pie-Recipe.md",
				});
				await act({
					from: "Recipe/Pie/Berry/Diagram-Berry-Pie-Recipe.png",
					kind: "renamePath",
					to: "Recipe/Pie/Berry/Diagram-Fish-Pie-Recipe.png",
				});

				const vault = await snapshot();
				const paths = vault.files.map(({ path }) => path);
				expect(paths).toContain("Recipe/Pie/Fish/Steps-Fish-Pie-Recipe.md");
				expect(paths).toContain("Recipe/Pie/Fish/Diagram-Fish-Pie-Recipe.png");
				expect(
					paths.some((path) => path.startsWith("Recipe/Pie/Berry/Steps")),
				).toBeFalse();
				expect(
					paths.some((path) => path.startsWith("Recipe/Pie/Berry/Diagram")),
				).toBeFalse();
				expect(
					vault.markdown["Recipe/Pie/Fish/__-Fish-Pie-Recipe.md"],
				).toContain("[[Steps-Fish-Pie-Recipe|Steps]]");
				expect(
					vault.markdown["Recipe/Pie/Fish/__-Fish-Pie-Recipe.md"],
				).toContain("[[Diagram-Fish-Pie-Recipe|Diagram]]");
			},
		);
	});
});
