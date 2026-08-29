import { describe, expect, it } from "bun:test";
import { withObsidianScenario } from "../harness";

const expectedCreatedPaths = [
	"Recipe/Berry_Pie/Ingredients-Berry_Pie-Recipe.md",
	"Recipe/Berry_Pie/Result_picture-Berry_Pie-Recipe.jpg",
	"Recipe/Berry_Pie/Steps-Berry_Pie-Recipe.md",
	"Recipe/Berry_Pie/__-Berry_Pie-Recipe.md",
	"Recipe/Soup/Ramen/Ingredients-Ramen-Soup-Recipe.md",
	"Recipe/Soup/Ramen/Result_picture-Ramen-Soup-Recipe.jpg",
	"Recipe/Soup/Ramen/Steps-Ramen-Soup-Recipe.md",
	"Recipe/Soup/Ramen/__-Ramen-Soup-Recipe.md",
];

describe("Obsidian E2E - create Library content", () => {
	it("heals nested PathKing and root NameKing creates", async () => {
		await withObsidianScenario(
			{
				fixture: [
					{
						content: "# Anchor",
						path: "Recipe/Soup/Anchor.md",
					},
				],
				id: "create-more-files",
			},
			async ({ act, snapshot }) => {
				await act({
					content: "# Ingredients",
					kind: "createFile",
					path: "Recipe/Berry_Pie/Ingredients.md",
				});
				await act({
					content: "# Steps",
					kind: "createFile",
					path: "Recipe/Berry_Pie/Steps.md",
				});
				await act({
					bytes: [0],
					kind: "createBinary",
					path: "Recipe/Berry_Pie/Result_picture.jpg",
				});

				await act({
					content: "# Ingredients",
					kind: "createFile",
					path: "Ingredients-Ramen-Soup-Recipe.md",
				});
				await act({
					content: "# Steps",
					kind: "createFile",
					path: "Steps-Ramen-Soup-Recipe.md",
				});
				await act({
					bytes: [0],
					kind: "createBinary",
					path: "Result_picture-Ramen-Soup-Recipe.jpg",
				});

				const vault = await snapshot();
				for (const path of expectedCreatedPaths) {
					expect(vault.files.some((file) => file.path === path)).toBeTrue();
				}
				expect(
					vault.files.some(({ path }) =>
						path === "Ingredients-Ramen-Soup-Recipe.md" ||
						path === "Steps-Ramen-Soup-Recipe.md" ||
						path === "Result_picture-Ramen-Soup-Recipe.jpg",
					),
				).toBeFalse();
			},
		);
	});
});
