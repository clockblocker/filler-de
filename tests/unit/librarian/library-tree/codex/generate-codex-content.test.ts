import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import { generateCodexContent } from "../../../../../src/commanders/librarian-new/healer/library-tree/codex/generate-codex-content";
import {
	TreeNodeStatus,
	TreeNodeType,
} from "../../../../../src/commanders/librarian-new/healer/library-tree/tree-node/types/atoms";
import type { SectionNodeSegmentId } from "../../../../../src/commanders/librarian-new/healer/library-tree/tree-node/types/node-segment-id";
import type {
	FileNode,
	ScrollNode,
	SectionNode,
} from "../../../../../src/commanders/librarian-new/healer/library-tree/tree-node/types/tree-node";
import type { NodeName } from "../../../../../src/commanders/librarian-new/types/schemas/node-name";
import { defaultSettingsForUnitTests } from "../../../common-utils/consts";
import { setupGetParsedUserSettingsSpy } from "../../../common-utils/setup-spy";

let getParsedUserSettingsSpy: ReturnType<typeof spyOn>;

beforeEach(() => {
	getParsedUserSettingsSpy = setupGetParsedUserSettingsSpy();
});

afterEach(() => {
	getParsedUserSettingsSpy.mockRestore();
});

// ─── Helpers ───

const sec = (name: string): SectionNodeSegmentId =>
	`${name}﹘Section﹘` as SectionNodeSegmentId;

const scroll = (
	name: string,
	status: TreeNodeStatus = TreeNodeStatus.NotStarted,
): ScrollNode => ({
	extension: "md",
	nodeName: name as NodeName,
	status,
	type: TreeNodeType.Scroll,
});

const file = (name: string): FileNode => ({
	extension: "png",
	nodeName: name as NodeName,
	status: TreeNodeStatus.Unknown,
	type: TreeNodeType.File,
});

const section = (
	name: string,
	children: Record<string, SectionNode | ScrollNode | FileNode> = {},
): SectionNode => ({
	children: children as SectionNode["children"],
	nodeName: name as NodeName,
	type: TreeNodeType.Section,
});

describe("generateCodexContent", () => {
	describe("root library codex", () => {
		it("generates empty codex for empty library", () => {
			const librarySection = section("Library");
			const chain = [sec("Library")];

			const result = generateCodexContent(librarySection, chain);

			// Empty library: just newline
			expect(result).toBe("\n");
		});

		it("generates codex with scrolls at root", () => {
			const librarySection = section("Library", {
				"Note1﹘Scroll﹘md": scroll("Note1"),
				"Note2﹘Scroll﹘md": scroll("Note2", TreeNodeStatus.Done),
			});
			const chain = [sec("Library")];

			const result = generateCodexContent(librarySection, chain);

			// Root library has no parent backlink
			// Scrolls at depth 0 are shown (showScrollsInCodexesForDepth: 0)
			expect(result).toContain("- [ ] [[Note1|Note1]]");
			expect(result).toContain("- [x] [[Note2|Note2]]");
			expect(result).not.toContain("←"); // No parent backlink
		});

		it("generates codex with child sections", () => {
			const librarySection = section("Library", {
				"A﹘Section﹘": section("A", {
					"Note﹘Scroll﹘md": scroll("Note"),
				}),
			});
			const chain = [sec("Library")];

			const result = generateCodexContent(librarySection, chain);

			// Child section links to its codex
			expect(result).toContain("- [ ] [[__-A|A]]");
		});
	});

	describe("first-level section codex", () => {
		it("generates codex with parent backlink to library", () => {
			const sectionA = section("A", {
				"Note﹘Scroll﹘md": scroll("Note"),
			});
			const chain = [sec("Library"), sec("A")];

			const result = generateCodexContent(sectionA, chain);

			// Parent backlink to Library root codex
			expect(result).toContain("[[__-Library|← Library]]");
			// Scroll
			expect(result).toContain("- [ ] [[Note-A|Note]]");
		});
	});

	describe("nested section codex", () => {
		it("generates codex with parent backlink to parent section", () => {
			const sectionB = section("B", {
				"Note﹘Scroll﹘md": scroll("Note"),
			});
			const chain = [sec("Library"), sec("A"), sec("B")];

			const result = generateCodexContent(sectionB, chain);

			// Parent backlink to section A
			expect(result).toContain("[[__-A|← A]]");
			// Scroll with suffix
			expect(result).toContain("- [ ] [[Note-B-A|Note]]");
		});
	});

	describe("files", () => {
		it("formats files without checkbox", () => {
			const librarySection = section("Library", {
				"image﹘File﹘png": file("image"),
			});
			const chain = [sec("Library")];

			const result = generateCodexContent(librarySection, chain);

			// Files use dash, not checkbox
			expect(result).toContain("- [[image|image]]");
			expect(result).not.toContain("[ ]");
			expect(result).not.toContain("[x]");
		});
	});

	describe("nested sections with depth", () => {
		it("includes nested section children up to maxDepth", () => {
			const librarySection = section("Library", {
				"A﹘Section﹘": section("A", {
					"B﹘Section﹘": section("B", {
						"Note﹘Scroll﹘md": scroll("Note"),
					}),
				}),
			});
			const chain = [sec("Library")];

			const result = generateCodexContent(librarySection, chain);

			// Section A
			expect(result).toContain("- [ ] [[__-A|A]]");
			// Nested section B (indented)
			expect(result).toContain("\t- [ ] [[__-B-A|B]]");
		});

		it("respects maxDepth setting", () => {
			getParsedUserSettingsSpy.mockReturnValue({
				...defaultSettingsForUnitTests,
				maxSectionDepth: 0, // Don't show nested sections
			});

			const librarySection = section("Library", {
				"A﹘Section﹘": section("A", {
					"B﹘Section﹘": section("B"),
				}),
			});
			const chain = [sec("Library")];

			const result = generateCodexContent(librarySection, chain);

			// Section A shown
			expect(result).toContain("[[__-A|A]]");
			// Section B NOT shown (maxDepth = 0)
			expect(result).not.toContain("[[__-B-A|B]]");
		});
	});

	describe("showScrollsInCodexesForDepth", () => {
		it("hides scrolls beyond showScrollsForDepth", () => {
			getParsedUserSettingsSpy.mockReturnValue({
				...defaultSettingsForUnitTests,
				showScrollsInCodexesForDepth: 0, // Only show scrolls at depth 0
			});

			const librarySection = section("Library", {
				"A﹘Section﹘": section("A", {
					"NestedNote﹘Scroll﹘md": scroll("NestedNote"),
				}),
				"RootNote﹘Scroll﹘md": scroll("RootNote"),
			});
			const chain = [sec("Library")];

			const result = generateCodexContent(librarySection, chain);

			// Root scroll shown
			expect(result).toContain("[[RootNote|RootNote]]");
			// Nested scroll NOT shown (depth 1 > showScrollsInCodexesForDepth 0)
			expect(result).not.toContain("[[NestedNote");
		});

		it("shows scrolls at allowed depth", () => {
			getParsedUserSettingsSpy.mockReturnValue({
				...defaultSettingsForUnitTests,
				showScrollsInCodexesForDepth: 1, // Show scrolls at depth 0 and 1
			});

			const librarySection = section("Library", {
				"A﹘Section﹘": section("A", {
					"NestedNote﹘Scroll﹘md": scroll("NestedNote"),
				}),
			});
			const chain = [sec("Library")];

			const result = generateCodexContent(librarySection, chain);

			// Nested scroll shown (depth 1 <= showScrollsInCodexesForDepth 1)
			expect(result).toContain("[[NestedNote-A|NestedNote]]");
		});
	});

	describe("aggregated section status", () => {
		it("shows Done checkbox for section when all children Done", () => {
			const librarySection = section("Library", {
				"A﹘Section﹘": section("A", {
					"Note﹘Scroll﹘md": scroll("Note", TreeNodeStatus.Done),
				}),
			});
			const chain = [sec("Library")];

			const result = generateCodexContent(librarySection, chain);

			// Section A should have Done checkbox
			expect(result).toContain("- [x] [[__-A|A]]");
		});

		it("shows NotStarted checkbox for section when any child NotStarted", () => {
			const librarySection = section("Library", {
				"A﹘Section﹘": section("A", {
					"Note1﹘Scroll﹘md": scroll("Note1", TreeNodeStatus.Done),
					"Note2﹘Scroll﹘md": scroll("Note2", TreeNodeStatus.NotStarted),
				}),
			});
			const chain = [sec("Library")];

			const result = generateCodexContent(librarySection, chain);

			// Section A should have NotStarted checkbox
			expect(result).toContain("- [ ] [[__-A|A]]");
		});
	});
});
