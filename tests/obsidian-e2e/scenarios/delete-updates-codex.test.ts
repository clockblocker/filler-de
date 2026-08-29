import { describe, expect, it } from "bun:test";
import { withObsidianScenario } from "../harness";

const SCENARIO_ID = "delete-updates-codex";

const expectedPaths = [
	"Pie/Fish/Steps-Fish-Pie.md",
	"Pie/Fish/__-Fish-Pie.md",
	"Pie/__-Pie.md",
	"__-Library.md",
].sort();

describe("Obsidian E2E - delete updates codex", () => {
	it("removes a deleted scroll from its section codex", async () => {
		await withObsidianScenario(
			{
				fixture: [
					{
						content: "# Ingredients",
						path: "Pie/Fish/Ingredients.md",
					},
					{ content: "# Steps", path: "Pie/Fish/Steps.md" },
				],
				id: SCENARIO_ID,
			},
			async ({ act, snapshot, status }) => {
				const ready = await status();
				expect(ready.scenarioId).toBe(SCENARIO_ID);

				await act({
					kind: "deletePath",
					path: "Pie/Fish/Ingredients-Fish-Pie.md",
				});

				const vault = await snapshot();
				expect(vault.files.map(({ path }) => path)).toEqual(expectedPaths);

				const codex = vault.markdown["Pie/Fish/__-Fish-Pie.md"];
				expect(codex).toContain("[[Steps-Fish-Pie|Steps]]");
				expect(codex).not.toContain("Ingredients-Fish-Pie");
			},
		);
	});
});
