import { describe, expect, it } from "bun:test";
import { withObsidianScenario } from "../harness";

describe("Obsidian E2E - create and rename a Scroll", () => {
	it("replaces the old Scroll name in its Section codex", async () => {
		await withObsidianScenario(
			{
				fixture: [
					{ content: "# Anchor", path: "Recipe/Pie/Berry/Anchor.md" },
				],
				id: "create-and-rename-scroll",
			},
			async ({ act, snapshot }) => {
				await act({
					content: "# New scroll content",
					kind: "createFile",
					path: "Recipe/Pie/Berry/MyNote-Berry-Pie-Recipe.md",
				});
				await act({
					from: "Recipe/Pie/Berry/MyNote-Berry-Pie-Recipe.md",
					kind: "renamePath",
					to: "Recipe/Pie/Berry/Renamed-Berry-Pie-Recipe.md",
				});

				const vault = await snapshot();
				const codex = vault.markdown["Recipe/Pie/Berry/__-Berry-Pie-Recipe.md"];
				expect(codex).toContain(
					"[[Renamed-Berry-Pie-Recipe|Renamed]]",
				);
				expect(codex).not.toContain("MyNote");
				expect(
					vault.files.some(
						({ path }) => path === "Recipe/Pie/Berry/Renamed-Berry-Pie-Recipe.md",
					),
				).toBeTrue();
			},
		);
	});
});
