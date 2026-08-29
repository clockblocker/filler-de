import { describe, expect, it } from "bun:test";
import { withObsidianScenario } from "../harness";

const SCENARIO_ID = "basename-healing";

const expectedPaths = [
	"Soup/Ramen/Anchor-Ramen-Soup.md",
	"Soup/Ramen/NewScroll-Ramen-Soup.md",
	"Soup/Ramen/__-Ramen-Soup.md",
	"Soup/__-Soup.md",
	"__-Library.md",
].sort();

function occurrences(content: string, fragment: string): number {
	return content.split(fragment).length - 1;
}

describe("Obsidian E2E - basename healing", () => {
	it("heals a newly created unsuffixed scroll and adds one backlink", async () => {
		await withObsidianScenario(
			{
				fixture: [
					{
						content: "# Anchor\n\nKeeps the target section present at boot.",
						path: "Soup/Ramen/Anchor.md",
					},
				],
				id: SCENARIO_ID,
			},
			async ({ act, snapshot, status }) => {
				const ready = await status();
				expect(ready.scenarioId).toBe(SCENARIO_ID);
				expect(ready.instanceId.length).toBeGreaterThan(0);
				expect(ready.generation).toBeGreaterThan(0);

				await act({
					content: "# NewScroll\n\nThis scroll starts without a Library suffix.",
					kind: "createFile",
					path: "Soup/Ramen/NewScroll.md",
				});

				const vault = await snapshot();
				expect(vault.files.map(({ path }) => path)).toEqual(expectedPaths);

				const codex = vault.markdown["Soup/Ramen/__-Ramen-Soup.md"];
				expect(codex).toContain(
					"[[NewScroll-Ramen-Soup|NewScroll]]",
				);

				const scroll = vault.markdown["Soup/Ramen/NewScroll-Ramen-Soup.md"];
				expect(scroll).toBeDefined();
				if (scroll === undefined) {
					throw new Error("Healed NewScroll content was absent from the snapshot");
				}
				expect(occurrences(scroll, "[[__-Ramen-Soup|← Ramen]]")).toBe(1);
			},
		);
	});
});
