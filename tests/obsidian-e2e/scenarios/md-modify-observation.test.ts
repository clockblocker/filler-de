import { describe, expect, it } from "bun:test";
import { withObsidianScenario } from "../harness";

const findPath = (paths: readonly string[], prefix: string): string => {
	const path = paths.find((candidate) => candidate.startsWith(prefix));
	if (!path) throw new Error(`No healed path starts with ${prefix}`);
	return path;
};

/**
 * The observed folder is a Section of the scenario's Library, not the
 * vault-root dictionary, so the dictionary store never treats its notes as
 * strays to heal.
 */
describe("Obsidian E2E - VAM Markdown modify observation", () => {
	it("observes exactly one modify event for a hand edit below the subscribed folder", async () => {
		await withObsidianScenario(
			{
				fixture: [
					{ content: "# Hund", path: "Tiere/Hund.md" },
					{ content: "# Other", path: "Notes/Other.md" },
				],
				id: "md-modify-observation",
				observeModifications: { path: "Tiere" },
			},
			async ({ act, modifications, snapshot }) => {
				const before = await snapshot();
				const markdownPaths = before.files
					.filter(({ kind }) => kind === "md")
					.map(({ path }) => path);
				const hund = findPath(markdownPaths, "Tiere/Hund");
				const other = findPath(markdownPaths, "Notes/Other");
				expect(await modifications()).toEqual([]);

				const edited = "# Hund\n\nhand edit";
				await act({ content: edited, kind: "modifyFile", path: hund });
				await act({
					content: "# Other\n\noutside the folder",
					kind: "modifyFile",
					path: other,
				});

				const observed = await modifications();
				expect(observed).toHaveLength(1);
				expect(observed[0]?.path).toBe(hund);
				expect(observed[0]?.size).toBe(Buffer.byteLength(edited));
				expect(observed[0]?.mtime).toBeGreaterThan(0);
			},
		);
	});

	it("does not echo the Librarian's own Codex writes below the subscribed folder", async () => {
		await withObsidianScenario(
			{
				fixture: [{ content: "# Hund", path: "Tiere/Hund.md" }],
				id: "md-modify-self-suppression",
				observeModifications: { path: "Tiere" },
			},
			async ({ act, modifications, snapshot }) => {
				const codexPathsOf = (files: readonly { path: string }[]) =>
					files
						.map(({ path }) => path)
						.filter((path) => path.startsWith("Tiere/__"));

				// The Codex already exists and does not list Maus yet, so the
				// Librarian's write below is a modification of an existing note.
				const before = await snapshot();
				const codexBefore = codexPathsOf(before.files);
				expect(codexBefore).toHaveLength(1);
				expect(before.markdown[codexBefore[0] ?? ""]).not.toContain(
					"Maus",
				);
				const hund = findPath(
					before.files
						.filter(({ kind }) => kind === "md")
						.map(({ path }) => path),
					"Tiere/Hund",
				);

				await act({
					content: "# Maus",
					kind: "createFile",
					path: "Tiere/Maus.md",
				});

				const vault = await snapshot();
				const codexPaths = codexPathsOf(vault.files);
				expect(codexPaths).toEqual(codexBefore);
				expect(vault.markdown[codexPaths[0] ?? ""]).toContain("Maus");

				// Positive control: the observer is live, so a hand edit is seen.
				const edited = "# Hund\n\nhand edit";
				await act({ content: edited, kind: "modifyFile", path: hund });

				const observed = await modifications();
				expect(
					observed.filter(({ path }) => codexPaths.includes(path)),
				).toEqual([]);
				expect(observed.map(({ path }) => path)).toContain(hund);
			},
		);
	});
});
