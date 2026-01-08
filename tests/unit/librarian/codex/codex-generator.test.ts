import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import { generateCodexContent } from "../../../../src/commanders/librarian-old/codex/codex-generator";
import type { SectionNodeDeprecated } from "../../../../src/commanders/librarian-old/types/tree-node";
import { TreeNodeStatusDeprecated, TreeNodeTypeDeprecated } from "../../../../src/commanders/librarian-old/types/tree-node";
import * as globalState from "../../../../src/global-state/global-state";
import type { ParsedUserSettings } from "../../../../src/global-state/parsed-settings";
import { SplitPathType } from "../../../../src/managers/obsidian/vault-action-manager/types/split-path";

// Default settings for tests
const defaultSettings: ParsedUserSettings = {
	apiProvider: "google",
	googleApiKey: "",
	maxSectionDepth: 6,
	showScrollsInCodexesForDepth: 0,
	splitPathToLibraryRoot: {
		basename: "Library",
		pathParts: [],
		type: SplitPathType.Folder,
	},
	suffixDelimiter: "-",
};

// Shared mocking setup for all tests
let getParsedUserSettingsSpy: ReturnType<typeof spyOn>;

beforeEach(() => {
	getParsedUserSettingsSpy = spyOn(globalState, "getParsedUserSettings").mockReturnValue({
		...defaultSettings,
	});
});

afterEach(() => {
	getParsedUserSettingsSpy.mockRestore();
});

function createSection(
	nodeName: string,
	nodeNameChainToParent: string[],
	children: SectionNodeDeprecated["children"] = [],
	status: typeof TreeNodeStatusDeprecated.Done | typeof TreeNodeStatusDeprecated.NotStarted = TreeNodeStatusDeprecated.NotStarted,
): SectionNodeDeprecated {
	return {
		children,
		nodeName,
		nodeNameChainToParent,
		status,
		type: TreeNodeTypeDeprecated.Section,
	};
}

describe("generateCodexContent", () => {
	describe("backlink", () => {
		it("includes backlink for nested section", () => {
			const section = createSection("B", ["Library", "A"]);
			const content = generateCodexContent(section);

			expect(content).toContain("[[__-A|← A]]");
		});

		it("includes backlink for root section (first level under library)", () => {
			const section = createSection("Root", ["Library"]);
			const content = generateCodexContent(section);

			expect(content).toContain("[[__-Library|← Library]]");
		});

		it("no backlink for root library", () => {
			const section = createSection("Library", []);
			const content = generateCodexContent(section);

			expect(content).not.toContain("←");
		});
	});

	describe("scroll children", () => {
		it("renders scroll with checkbox and full basename", () => {
			const section = createSection("A", ["Library"], [
				{
					extension: "md",
					nodeName: "Note",
					nodeNameChainToParent: ["Library", "A"],
					status: TreeNodeStatusDeprecated.NotStarted,
					type: TreeNodeTypeDeprecated.Scroll,
				},
			]);

			const content = generateCodexContent(section);

			// Link target has suffix, display is just nodeName
			expect(content).toContain("- [ ] [[Note-A|Note]]");
		});

		it("renders done scroll with checked checkbox", () => {
			const section = createSection("A", ["Library"], [
				{
					extension: "md",
					nodeName: "DoneNote",
					nodeNameChainToParent: ["Library", "A"],
					status: TreeNodeStatusDeprecated.Done,
					type: TreeNodeTypeDeprecated.Scroll,
				},
			]);

			const content = generateCodexContent(section);

			expect(content).toContain("- [x] [[DoneNote-A|DoneNote]]");
		});
	});

	describe("file children", () => {
		it("renders file without checkbox", () => {
			const section = createSection("A", ["Library"], [
				{
					extension: "pdf",
					nodeName: "Document",
					nodeNameChainToParent: ["Library", "A"],
					status: TreeNodeStatusDeprecated.Unknown,
					type: TreeNodeTypeDeprecated.File,
				},
			]);

			const content = generateCodexContent(section);

			expect(content).toContain("- [[Document-A|Document]]");
			expect(content).not.toContain("[ ]");
			expect(content).not.toContain("[x]");
		});
	});

	describe("section children", () => {
		it("renders section with link to its codex (suffixed)", () => {
			const childSection = createSection("B", ["Library", "A"]);
			const section = createSection("A", ["Library"], [childSection]);

			const content = generateCodexContent(section);

			// Codex link: __-B-A (codex for B, inside A)
			expect(content).toContain("- [ ] [[__-B-A|B]]");
		});

		it("renders nested scrolls under section", () => {
			getParsedUserSettingsSpy.mockReturnValue({
				...defaultSettings,
				showScrollsInCodexesForDepth: 1,
			});
			const childSection = createSection("B", ["Library", "A"], [
				{
					extension: "md",
					nodeName: "NestedNote",
					nodeNameChainToParent: ["Library", "A", "B"],
					status: TreeNodeStatusDeprecated.NotStarted,
					type: TreeNodeTypeDeprecated.Scroll,
				},
			]);
			const section = createSection("A", ["Library"], [childSection]);

			const content = generateCodexContent(section);

			// Section B at depth 0: __-B-A
			expect(content).toContain("- [ ] [[__-B-A|B]]");
			// NestedNote at depth 1: NestedNote-B-A
			expect(content).toContain("\t- [ ] [[NestedNote-B-A|NestedNote]]");
		});
	});

	describe("max depth", () => {
		it("stops recursing at max depth", () => {
			// Create deep nesting: A > B > C > D > E
			const sectionE = createSection("E", ["Library", "A", "B", "C", "D"], [
				{
					extension: "md",
					nodeName: "DeepNote",
					nodeNameChainToParent: ["Library", "A", "B", "C", "D", "E"],
					status: TreeNodeStatusDeprecated.NotStarted,
					type: TreeNodeTypeDeprecated.Scroll,
				},
			]);
			const sectionD = createSection("D", ["Library", "A", "B", "C"], [sectionE]);
			const sectionC = createSection("C", ["Library", "A", "B"], [sectionD]);
			const sectionB = createSection("B", ["Library", "A"], [sectionC]);
			const section = createSection("A", ["Library"], [sectionB]);

			// With maxDepth=2, should show B, C, but D should just be a link
			getParsedUserSettingsSpy.mockReturnValue({
				...defaultSettings,
				maxSectionDepth: 2,
			});
			const content = generateCodexContent(section);

			// B at depth 0: __-B-A
			expect(content).toContain("- [ ] [[__-B-A|B]]");
			// C at depth 1: __-C-B-A
			expect(content).toContain("\t- [ ] [[__-C-B-A|C]]");
			// D at depth 2: __-D-C-B-A
			expect(content).toContain("\t\t- [ ] [[__-D-C-B-A|D]]");
			// E should NOT appear (beyond max depth)
			expect(content).not.toContain("__-E");
		});
	});

});
// Note: Codex files are no longer stored in tree, so no need to test skipping them
