import { describe, expect, it } from "bun:test";
import { withObsidianScenario } from "../harness";

describe("Obsidian E2E - change Librarian status", () => {
	it("marks one Scroll Done and updates its ancestor Section", async () => {
		await withObsidianScenario(
			{
				fixture: [
					{ content: "# Steps", path: "Recipe/Pie/Fish/Steps.md" },
					{ bytes: [1, 2, 3], path: "Recipe/Pie/Fish/Diagram.png" },
				],
				id: "change-scroll-status",
			},
			async ({ act, snapshot }) => {
				await act({
					checked: false,
					kind: "toggleCodexEntry",
					lineContent: "[[Steps-Fish-Pie-Recipe|Steps]]",
					path: "Recipe/Pie/Fish/__-Fish-Pie-Recipe.md",
				});

				const vault = await snapshot();
				expect(vault.markdown["Recipe/Pie/Fish/__-Fish-Pie-Recipe.md"]).toContain(
					"- [x] [[Steps-Fish-Pie-Recipe|Steps]]",
				);
				expect(vault.markdown["Recipe/Pie/__-Pie-Recipe.md"]).toContain(
					"- [x] [[__-Fish-Pie-Recipe|Fish]]",
				);
			},
		);
	});

	it("marks every descendant Scroll Done when a Section is checked", async () => {
		await withObsidianScenario(
			{
				fixture: [
					{ content: "# Ingredients", path: "Recipe/Pie/Berry/Ingredients.md" },
					{ content: "# Steps", path: "Recipe/Pie/Berry/Steps.md" },
				],
				id: "change-section-status",
			},
			async ({ act, snapshot }) => {
				await act({
					checked: false,
					kind: "toggleCodexEntry",
					lineContent: "[[__-Berry-Pie-Recipe|Berry]]",
					path: "Recipe/Pie/__-Pie-Recipe.md",
				});

				const vault = await snapshot();
				const berryCodex =
					vault.markdown["Recipe/Pie/Berry/__-Berry-Pie-Recipe.md"];
				expect(berryCodex).toContain(
					"- [x] [[Ingredients-Berry-Pie-Recipe|Ingredients]]",
				);
				expect(berryCodex).toContain(
					"- [x] [[Steps-Berry-Pie-Recipe|Steps]]",
				);
				expect(vault.markdown["Recipe/Pie/__-Pie-Recipe.md"]).toContain(
					"- [x] [[__-Berry-Pie-Recipe|Berry]]",
				);
			},
		);
	});
});
