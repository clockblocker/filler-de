import { describe, expect, it } from "bun:test";
import { withObsidianScenario } from "../harness";

const SCENARIO_ID = "split-to-pages";
const STORY_CONTENT = Array.from(
	{ length: 120 },
	(_, index) =>
		`Paragraph ${index}. This is a complete sentence in the desktop split story.`,
).join("\n\n");

describe("Obsidian E2E - split to pages", () => {
	it("reads and transforms one coherent active source editor before projecting its Codexes", async () => {
		await withObsidianScenario(
			{
				fixture: [{ content: STORY_CONTENT, path: "Story.md" }],
				id: SCENARIO_ID,
			},
			async ({ act, snapshot }) => {
				const initial = await snapshot();
				const sourcePath = initial.files.find(
					({ kind, path }) => kind === "md" && path.startsWith("Story"),
				)?.path;
				expect(sourcePath).toBeDefined();
				if (!sourcePath) throw new Error("The Story fixture was not visible");

				await act({ kind: "runSplitToPages", path: sourcePath });

				const vault = await snapshot();
				const paths = vault.files.map(({ path }) => path);
				const pagePaths = paths.filter((path) =>
					path.startsWith("Story/Story_Page_"),
				);
				const pageContents = pagePaths
					.map((path) => vault.markdown[path])
					.join("\n");

				expect(paths).not.toContain(sourcePath);
				expect(pagePaths.length).toBeGreaterThan(1);
				expect(pageContents).toContain(
					"Paragraph 0. This is a complete sentence in the desktop split story.",
				);
				expect(pageContents).toContain(
					"Paragraph 119. This is a complete sentence in the desktop split story.",
				);
				expect(paths).toContain("Story/__-Story.md");
				expect(vault.markdown["__-Library.md"]).toContain(
					"[[__-Story|Story]]",
				);

				const destinationCodex = vault.markdown["Story/__-Story.md"];
				for (const pagePath of pagePaths) {
					const pageBasename = pagePath.slice("Story/".length, -".md".length);
					expect(destinationCodex).toContain(`[[${pageBasename}|`);
					expect(vault.markdown[pagePath]).toContain(
						"[[__-Story|← Story]]",
					);
				}
			},
		);
	});
});
