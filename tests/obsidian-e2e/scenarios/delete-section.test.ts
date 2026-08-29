import { describe, expect, it } from "bun:test";
import { withObsidianScenario } from "../harness";

describe("Obsidian E2E - delete a Section", () => {
	it("removes its descendants and its entry from the parent codex", async () => {
		await withObsidianScenario(
			{
				fixture: [
					{ content: "# Ramen", path: "Recipe/Soup/Ramen/Steps.md" },
					{
						content: "# Ingredients",
						path: "Recipe/Soup/Pho_Bo/Ingredients.md",
					},
					{ content: "# Steps", path: "Recipe/Soup/Pho_Bo/Steps.md" },
					{ bytes: [0], path: "Recipe/Soup/Pho_Bo/Result_picture.jpg" },
				],
				id: "delete-section",
			},
			async ({ act, snapshot }) => {
				await act({ kind: "deletePath", path: "Recipe/Soup/Pho_Bo" });

				const vault = await snapshot();
				expect(vault.files.some(({ path }) => path.includes("Pho_Bo"))).toBeFalse();
				const soupCodex = vault.markdown["Recipe/Soup/__-Soup-Recipe.md"];
				expect(soupCodex).toContain("[[__-Ramen-Soup-Recipe|Ramen]]");
				expect(soupCodex).not.toContain("Pho_Bo");
			},
		);
	});
});
