import { describe, expect, it } from "bun:test";
import { withObsidianScenario } from "../harness";

const expectedPaths = [
	"Recipe/Pie/Ingredients-Pie-Recipe.md",
	"Recipe/Pie/Result_picture-Pie-Recipe.jpg",
	"Recipe/Pie/Steps-Pie-Recipe.md",
	"Recipe/Pie/__-Pie-Recipe.md",
	"Recipe/Soup/Pho_Bo/Ingredients-Pho_Bo-Soup-Recipe.md",
	"Recipe/Soup/Pho_Bo/Result_picture-Pho_Bo-Soup-Recipe.jpg",
	"Recipe/Soup/Pho_Bo/Steps-Pho_Bo-Soup-Recipe.md",
	"Recipe/Soup/Pho_Bo/__-Pho_Bo-Soup-Recipe.md",
	"Recipe/Soup/__-Soup-Recipe.md",
	"Recipe/__-Recipe.md",
	"__-Library.md",
].sort();

describe("Obsidian E2E - startup healing", () => {
	it("creates codexes and canonical suffixes for the initial Library", async () => {
		await withObsidianScenario(
			{
				fixture: [
					{ content: "# Ingredients", path: "Recipe/Pie/Ingredients.md" },
					{ content: "# Steps", path: "Recipe/Pie/Steps.md" },
					{ bytes: [0], path: "Recipe/Pie/Result_picture.jpg" },
					{
						content: "# Ingredients",
						path: "Recipe/Soup/Pho_Bo/Ingredients.md",
					},
					{ content: "# Steps", path: "Recipe/Soup/Pho_Bo/Steps.md" },
					{ bytes: [0], path: "Recipe/Soup/Pho_Bo/Result_picture.jpg" },
				],
				id: "startup-healing",
			},
			async ({ snapshot }) => {
				const vault = await snapshot();

				expect(vault.files.map(({ path }) => path)).toEqual(expectedPaths);
				expect(vault.markdown["Recipe/__-Recipe.md"]).toContain(
					"[[__-Pie-Recipe|Pie]]",
				);
				expect(vault.markdown["Recipe/__-Recipe.md"]).toContain(
					"[[__-Soup-Recipe|Soup]]",
				);
			},
		);
	});
});
