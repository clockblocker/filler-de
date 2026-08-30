import { describe, expect, it } from "bun:test";
import { withObsidianScenario } from "../harness";

describe("Obsidian E2E - rename a Section", () => {
	it("heals every descendant name and the parent Codex", async () => {
		await withObsidianScenario(
			{
				fixture: [
					{ content: "# Steps", path: "Recipe/Pie/Berry/Steps.md" },
					{ bytes: [1, 2, 3], path: "Recipe/Pie/Berry/Diagram.png" },
				],
				id: "rename-section",
			},
			async ({ act, snapshot }) => {
				await act({
					from: "Recipe/Pie/Berry",
					kind: "renamePath",
					to: "Recipe/Pie/Jam",
				});

				const vault = await snapshot();
				const paths = vault.files.map(({ path }) => path);
				expect(paths).toContain("Recipe/Pie/Jam/Steps-Jam-Pie-Recipe.md");
				expect(paths).toContain("Recipe/Pie/Jam/Diagram-Jam-Pie-Recipe.png");
				expect(paths).toContain("Recipe/Pie/Jam/__-Jam-Pie-Recipe.md");
				expect(paths.some((path) => path.includes("Berry"))).toBeFalse();
				expect(vault.markdown["Recipe/Pie/__-Pie-Recipe.md"]).toContain(
					"[[__-Jam-Pie-Recipe|Jam]]",
				);
			},
		);
	});
});
