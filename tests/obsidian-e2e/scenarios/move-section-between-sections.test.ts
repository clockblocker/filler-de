import { describe, expect, it } from "bun:test";
import { withObsidianScenario } from "../harness";

describe("Obsidian E2E - move a Section between Sections", () => {
	it("heals every descendant suffix and both parent Codexes", async () => {
		await withObsidianScenario(
			{
				fixture: [
					{ content: "# Steps", path: "Recipe/Pie/Berry/Steps.md" },
					{ bytes: [1, 2, 3], path: "Recipe/Pie/Berry/Diagram.png" },
					{ content: "# Archive anchor", path: "Archive/Anchor.md" },
				],
				id: "move-section-between-sections",
			},
			async ({ act, snapshot }) => {
				await act({
					from: "Recipe/Pie/Berry",
					kind: "renamePath",
					to: "Archive/Berry",
				});

				const vault = await snapshot();
				const paths = vault.files.map(({ path }) => path);
				expect(paths).toContain("Archive/Berry/Steps-Berry-Archive.md");
				expect(paths).toContain("Archive/Berry/Diagram-Berry-Archive.png");
				expect(paths).toContain("Archive/Berry/__-Berry-Archive.md");
				expect(paths.some((path) => path.startsWith("Recipe/Pie/Berry"))).toBeFalse();
				expect(vault.markdown["Archive/__-Archive.md"]).toContain(
					"[[__-Berry-Archive|Berry]]",
				);
				expect(vault.markdown["Recipe/Pie/__-Pie-Recipe.md"]).not.toContain(
					"Berry",
				);
			},
		);
	});
});
