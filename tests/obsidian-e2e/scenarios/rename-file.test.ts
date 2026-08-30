import { describe, expect, it } from "bun:test";
import { withObsidianScenario } from "../harness";

describe("Obsidian E2E - rename a File by Core Name", () => {
	it("restores its Section suffix without changing its parent", async () => {
		await withObsidianScenario(
			{
				fixture: [
					{ content: "# Anchor", path: "Recipe/Pie/Berry/Anchor.md" },
					{
						bytes: [1, 2, 3],
						path: "Recipe/Pie/Berry/Diagram-Berry-Pie-Recipe.png",
					},
				],
				id: "rename-file",
			},
			async ({ act, snapshot }) => {
				await act({
					from: "Recipe/Pie/Berry/Diagram-Berry-Pie-Recipe.png",
					kind: "renamePath",
					to: "Recipe/Pie/Berry/Renamed.png",
				});

				const vault = await snapshot();
				expect(vault.files.map(({ path }) => path)).toContain(
					"Recipe/Pie/Berry/Renamed-Berry-Pie-Recipe.png",
				);
				expect(
					vault.files.some(({ path }) => path.endsWith("/Renamed.png")),
				).toBeFalse();
				expect(
					vault.markdown["Recipe/Pie/Berry/__-Berry-Pie-Recipe.md"],
				).toContain("[[Renamed-Berry-Pie-Recipe|Renamed]]");
			},
		);
	});
});
