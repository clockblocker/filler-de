import type { TFile } from "obsidian";
import { describe, expect, it } from "vitest";
import { generateCodexContent } from "../../../../src/commanders/librarian/codex/codex-generator";
import type { SectionNode } from "../../../../src/commanders/librarian/types/tree-node";
import { TreeNodeStatus, TreeNodeType } from "../../../../src/commanders/librarian/types/tree-node";

const fakeTFile = null as unknown as TFile;

function createSection(
	coreName: string,
	coreNameChainToParent: string[],
	children: SectionNode["children"] = [],
	status: typeof TreeNodeStatus.Done | typeof TreeNodeStatus.NotStarted = TreeNodeStatus.NotStarted,
): SectionNode {
	return {
		children,
		coreName,
		coreNameChainToParent,
		status,
		type: TreeNodeType.Section,
	};
}

describe("generateCodexContent", () => {
	describe("backlink", () => {
		it("includes backlink for nested section", () => {
			const section = createSection("B", ["A"]);
			const content = generateCodexContent(section);

			expect(content).toContain("[[__A|← A]]");
		});

		it("no backlink for root section", () => {
			const section = createSection("Root", []);
			const content = generateCodexContent(section);

			expect(content).not.toContain("←");
		});
	});

	describe("scroll children", () => {
		it("renders scroll with checkbox", () => {
			const section = createSection("A", [], [
				{
					coreName: "Note",
					coreNameChainToParent: ["A"],
					status: TreeNodeStatus.NotStarted,
					tRef: fakeTFile,
					type: TreeNodeType.Scroll,
				},
			]);

			const content = generateCodexContent(section);

			expect(content).toContain("- [ ] [[Note|Note]]");
		});

		it("renders done scroll with checked checkbox", () => {
			const section = createSection("A", [], [
				{
					coreName: "DoneNote",
					coreNameChainToParent: ["A"],
					status: TreeNodeStatus.Done,
					tRef: fakeTFile,
					type: TreeNodeType.Scroll,
				},
			]);

			const content = generateCodexContent(section);

			expect(content).toContain("- [x] [[DoneNote|DoneNote]]");
		});
	});

	describe("file children", () => {
		it("renders file without checkbox", () => {
			const section = createSection("A", [], [
				{
					coreName: "Document",
					coreNameChainToParent: ["A"],
					status: TreeNodeStatus.Unknown,
					tRef: fakeTFile,
					type: TreeNodeType.File,
				},
			]);

			const content = generateCodexContent(section);

			expect(content).toContain("- [[Document|Document]]");
			expect(content).not.toContain("[ ]");
			expect(content).not.toContain("[x]");
		});
	});

	describe("section children", () => {
		it("renders section with link to its codex", () => {
			const childSection = createSection("B", ["A"]);
			const section = createSection("A", [], [childSection]);

			const content = generateCodexContent(section);

			expect(content).toContain("- [ ] [[__B|B]]");
		});

		it("renders nested scrolls under section", () => {
			const childSection = createSection("B", ["A"], [
				{
					coreName: "NestedNote",
					coreNameChainToParent: ["A", "B"],
					status: TreeNodeStatus.NotStarted,
					tRef: fakeTFile,
					type: TreeNodeType.Scroll,
				},
			]);
			const section = createSection("A", [], [childSection]);

			const content = generateCodexContent(section);

			// Section B at depth 0
			expect(content).toContain("- [ ] [[__B|B]]");
			// NestedNote at depth 1 (indented)
			expect(content).toContain("\t- [ ] [[NestedNote|NestedNote]]");
		});
	});

	describe("max depth", () => {
		it("stops recursing at max depth", () => {
			// Create deep nesting: A > B > C > D > E
			const sectionE = createSection("E", ["A", "B", "C", "D"], [
				{
					coreName: "DeepNote",
					coreNameChainToParent: ["A", "B", "C", "D", "E"],
					status: TreeNodeStatus.NotStarted,
					tRef: fakeTFile,
					type: TreeNodeType.Scroll,
				},
			]);
			const sectionD = createSection("D", ["A", "B", "C"], [sectionE]);
			const sectionC = createSection("C", ["A", "B"], [sectionD]);
			const sectionB = createSection("B", ["A"], [sectionC]);
			const section = createSection("A", [], [sectionB]);

			// With maxDepth=2, should show B, C, but D should just be a link
			const content = generateCodexContent(section, { maxSectionDepth: 2 });

			// B at depth 0
			expect(content).toContain("- [ ] [[__B|B]]");
			// C at depth 1
			expect(content).toContain("\t- [ ] [[__C|C]]");
			// D at depth 2 (just link, no children)
			expect(content).toContain("\t\t- [ ] [[__D|D]]");
			// E should NOT appear (beyond max depth)
			expect(content).not.toContain("__E");
		});
	});

	describe("codex children", () => {
		it("skips codex files in listing", () => {
			const section = createSection("A", [], [
				{
					coreName: "__A",
					coreNameChainToParent: ["A"],
					tRef: fakeTFile,
					type: TreeNodeType.Codex,
				},
				{
					coreName: "Note",
					coreNameChainToParent: ["A"],
					status: TreeNodeStatus.NotStarted,
					tRef: fakeTFile,
					type: TreeNodeType.Scroll,
				},
			]);

			const content = generateCodexContent(section);

			expect(content).not.toContain("[[__A|__A]]");
			expect(content).toContain("[[Note|Note]]");
		});
	});
});
