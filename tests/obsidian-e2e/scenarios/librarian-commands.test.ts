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
