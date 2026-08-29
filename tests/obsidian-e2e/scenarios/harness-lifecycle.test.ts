import { describe, expect, it } from "bun:test";
import { withObsidianScenario } from "../harness";

const SCENARIO_ID = "harness-lifecycle";

describe("Obsidian E2E harness lifecycle", () => {
	it("binds status and snapshots to one isolated scenario", async () => {
		await withObsidianScenario(
			{
				fixture: [{ content: "# Probe\n\nbefore", path: "Probe.md" }],
				id: SCENARIO_ID,
			},
			async ({ act, snapshot, status }) => {
				const before = await status();
				const initial = await snapshot();
				const probe = initial.files.find(
					({ kind, path }) => kind === "md" && path.startsWith("Probe"),
				);
				expect(probe).toBeDefined();
				if (!probe) throw new Error("The harness fixture was not visible");

				await act({
					content: "# Probe\n\nafter",
					kind: "modifyFile",
					path: probe.path,
				});

				const vault = await snapshot();
				const after = await status();
				const updatedProbe = Object.entries(vault.markdown).find(([path]) =>
					path.startsWith("Probe"),
				);

				expect(before.scenarioId).toBe(SCENARIO_ID);
				expect(before.instanceId).toBe(after.instanceId);
				expect(before.generation).toBe(after.generation);
				expect(updatedProbe?.[1]).toContain("after");
				expect(vault.root).toBe("Library");
				expect(vault.files.map(({ path }) => path)).toEqual(
					[...vault.files.map(({ path }) => path)].sort(),
				);
			},
		);
	});
});
