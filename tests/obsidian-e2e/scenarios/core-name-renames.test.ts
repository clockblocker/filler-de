import { describe, expect, it } from "bun:test";
import { withObsidianScenario } from "../harness";

describe("Obsidian E2E - repeated Core Name changes", () => {
	it("keeps only the final Core Name in the Section codex", async () => {
		await withObsidianScenario(
			{
				fixture: [
					{ content: "# Anchor", path: "Recipe/Soup/Ramen/Anchor.md" },
				],
				id: "core-name-renames",
			},
			async ({ act, snapshot }) => {
				await act({
					content: "# Untitled note content",
					kind: "createFile",
					path: "Recipe/Soup/Ramen/Untitled.md",
				});
				await act({
					from: "Recipe/Soup/Ramen/Untitled-Ramen-Soup-Recipe.md",
					kind: "renamePath",
					to: "Recipe/Soup/Ramen/Draft-Ramen-Soup-Recipe.md",
				});
				await act({
					from: "Recipe/Soup/Ramen/Draft-Ramen-Soup-Recipe.md",
					kind: "renamePath",
					to: "Recipe/Soup/Ramen/Review-Ramen-Soup-Recipe.md",
				});
				await act({
					from: "Recipe/Soup/Ramen/Review-Ramen-Soup-Recipe.md",
					kind: "renamePath",
					to: "Recipe/Soup/Ramen/Final-Ramen-Soup-Recipe.md",
				});

				const vault = await snapshot();
				const codex = vault.markdown["Recipe/Soup/Ramen/__-Ramen-Soup-Recipe.md"];
				expect(codex).toContain("[[Final-Ramen-Soup-Recipe|Final]]");
				expect(codex).not.toContain("Untitled");
				expect(codex).not.toContain("Draft");
				expect(codex).not.toContain("Review");
			},
		);
	});
});
