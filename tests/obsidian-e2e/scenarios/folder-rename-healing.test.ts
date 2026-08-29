import { describe, expect, it } from "bun:test";
import { withObsidianScenario } from "../harness";

const SCENARIO_ID = "folder-rename-healing";

const expectedPaths = [
	"Recipe/Pie/Berry/Ingredients-Berry-Pie-Recipe.md",
	"Recipe/Pie/Berry/Result_picture-Berry-Pie-Recipe.jpg",
	"Recipe/Pie/Berry/Steps-Berry-Pie-Recipe.md",
	"Recipe/Pie/Berry/__-Berry-Pie-Recipe.md",
	"Recipe/Pie/Fish/Ingredients-Fish-Pie-Recipe.md",
	"Recipe/Pie/Fish/Result_picture-Fish-Pie-Recipe.jpg",
	"Recipe/Pie/Fish/Steps-Fish-Pie-Recipe.md",
	"Recipe/Pie/Fish/__-Fish-Pie-Recipe.md",
	"Recipe/Pie/__-Pie-Recipe.md",
	"Recipe/__-Recipe.md",
	"__-Library.md",
].sort();

describe("Obsidian E2E - folder rename healing", () => {
	it("reconstructs hyphenated section intent and heals descendant suffixes", async () => {
		await withObsidianScenario(
			{
				fixture: [
					{ content: "# Ingredients", path: "Recipe/Pie/Ingredients.md" },
					{ content: "# Steps", path: "Recipe/Pie/Steps.md" },
					{ bytes: [0], path: "Recipe/Pie/Result_picture.jpg" },
					{
						content: "# Ingredients",
						path: "Recipe/Berry_Pie/Ingredients.md",
					},
					{ content: "# Steps", path: "Recipe/Berry_Pie/Steps.md" },
					{ bytes: [0], path: "Recipe/Berry_Pie/Result_picture.jpg" },
				],
				id: SCENARIO_ID,
			},
			async ({ act, snapshot, status }) => {
				const ready = await status();
				expect(ready.scenarioId).toBe(SCENARIO_ID);

				await act({
					from: "Recipe/Pie",
					kind: "renamePath",
					to: "Recipe/Fish-Pie",
				});
				await act({
					from: "Recipe/Berry_Pie",
					kind: "renamePath",
					to: "Recipe/Berry-Pie",
				});

				const vault = await snapshot();
				expect(vault.files.map(({ path }) => path)).toEqual(expectedPaths);
				expect(
					vault.files.filter(({ kind }) => kind === "file").map(({ path }) => path),
				).toEqual(
					[
						"Recipe/Pie/Berry/Result_picture-Berry-Pie-Recipe.jpg",
						"Recipe/Pie/Fish/Result_picture-Fish-Pie-Recipe.jpg",
					].sort(),
				);

				const recipeCodex = vault.markdown["Recipe/__-Recipe.md"];
				expect(recipeCodex).toContain("[[__-Pie-Recipe|Pie]]");

				const pieCodex = vault.markdown["Recipe/Pie/__-Pie-Recipe.md"];
				expect(pieCodex).toContain(
					"[[__-Berry-Pie-Recipe|Berry]]",
				);
				expect(pieCodex).toContain("[[__-Fish-Pie-Recipe|Fish]]");
			},
		);
	});
});
