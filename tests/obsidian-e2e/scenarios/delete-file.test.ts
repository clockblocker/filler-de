import { describe, expect, it } from "bun:test";
import { withObsidianScenario } from "../harness";

describe("Obsidian E2E - delete a File", () => {
	it("removes the File from its Section Codex", async () => {
		await withObsidianScenario(
			{
				fixture: [
					{ content: "# Anchor", path: "Recipe/Pie/Berry/Anchor.md" },
					{ bytes: [1, 2, 3], path: "Recipe/Pie/Berry/Diagram.png" },
				],
				id: "delete-file",
			},
			async ({ act, snapshot }) => {
				await act({
					kind: "deletePath",
					path: "Recipe/Pie/Berry/Diagram-Berry-Pie-Recipe.png",
				});

				const vault = await snapshot();
				expect(vault.files.some(({ path }) => path.includes("Diagram"))).toBeFalse();
				expect(
					vault.markdown["Recipe/Pie/Berry/__-Berry-Pie-Recipe.md"],
				).not.toContain("Diagram");
			},
		);
	});
});
