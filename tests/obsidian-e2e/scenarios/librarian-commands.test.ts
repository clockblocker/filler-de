import { describe, expect, it } from "bun:test";
import { withObsidianScenario } from "../harness";

describe("Obsidian E2E - Librarian commands", () => {
	it("splits the active editor selection into stable blocks", async () => {
		const selectedText = "Dies ist ein einfacher Satz.";
		await withObsidianScenario(
			{
				fixture: [
					{
						content: `Before.\n\n${selectedText}\n\nAfter.`,
						path: "Story.md",
					},
				],
				id: "split-in-blocks",
			},
			async ({ act, snapshot }) => {
				await act({
					kind: "runSplitInBlocks",
					path: "Story.md",
					selection: selectedText,
				});

				const vault = await snapshot();
				expect(vault.markdown["Story.md"]).toContain(`${selectedText} ^0`);
			},
		);
	});

	it("restarts the Librarian, which keeps healing afterwards", async () => {
		await withObsidianScenario(
			{
				fixture: [{ content: "# Anchor", path: "Recipe/Pie/Anchor.md" }],
				id: "restart-librarian",
			},
			async ({ act, snapshot }) => {
				await act({ kind: "restartLibrarian" });
				await act({
					content: "# Fresh",
					kind: "createFile",
					path: "Recipe/Pie/Fresh.md",
				});

				const vault = await snapshot();
				const paths = vault.files.map(({ path }) => path);
				expect(paths).toContain("Recipe/Pie/Anchor-Pie-Recipe.md");
				expect(paths).toContain("Recipe/Pie/Fresh-Pie-Recipe.md");
				expect(paths).not.toContain("Recipe/Pie/Fresh.md");
				expect(vault.markdown["Recipe/Pie/__-Pie-Recipe.md"]).toContain(
					"[[Fresh-Pie-Recipe|Fresh]]",
				);
			},
		);
	});

	it("navigates to the next and previous Scroll in display order", async () => {
		await withObsidianScenario(
			{
				fixture: [
					{ content: "# First", path: "Challenge/01 First.md" },
					{ content: "# Second", path: "Challenge/02 Second.md" },
				],
				id: "page-navigation",
			},
			async ({ act, status }) => {
				await act({
					direction: "next",
					kind: "runPageNavigation",
					path: "Challenge/01 First-Challenge.md",
				});
				expect((await status()).activePath).toBe(
					"Challenge/02 Second-Challenge.md",
				);

				await act({
					direction: "prev",
					kind: "runPageNavigation",
					path: "Challenge/02 Second-Challenge.md",
				});
				expect((await status()).activePath).toBe(
					"Challenge/01 First-Challenge.md",
				);
			},
		);
	});
});
