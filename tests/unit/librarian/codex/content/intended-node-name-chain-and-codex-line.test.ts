import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import {
	formatAsLine,
	tryParseAsIntendedTreeNode,
} from "../../../../../src/commanders/librarian/codex/content/intended-tree-node-and-codex-line";
import type { AnyIntendedTreeNode } from "../../../../../src/commanders/librarian/codex/content/schema/intended-tree-node";
import { CodexLineType } from "../../../../../src/commanders/librarian/codex/content/schema/literals";
import { TreeNodeStatus, TreeNodeType } from "../../../../../src/commanders/librarian/types/tree-node";
import * as globalState from "../../../../../src/global-state/global-state";
import type { ParsedUserSettings } from "../../../../../src/global-state/parsed-settings";
import { SplitPathType } from "../../../../../src/obsidian-vault-action-manager/types/split-path";

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

let getParsedUserSettingsSpy: ReturnType<typeof spyOn>;

beforeEach(() => {
	getParsedUserSettingsSpy = spyOn(globalState, "getParsedUserSettings").mockReturnValue({
		...defaultSettings,
	});
});

afterEach(() => {
	getParsedUserSettingsSpy.mockRestore();
});

function createScrollIntendedTreeNode(
	nodeName: string,
	nodeNameChainToParent: string[],
	status: typeof TreeNodeStatus.Done | typeof TreeNodeStatus.NotStarted = TreeNodeStatus.NotStarted,
): AnyIntendedTreeNode {
	return {
		node: {
			extension: "md",
			nodeName,
			nodeNameChainToParent,
			status,
			type: TreeNodeType.Scroll,
		},
		type: CodexLineType.Scroll,
	};
}

function createFileIntendedTreeNode(
	nodeName: string,
	nodeNameChainToParent: string[],
	extension: string = "pdf",
): AnyIntendedTreeNode {
	return {
		node: {
			extension,
			nodeName,
			nodeNameChainToParent,
			status: TreeNodeStatus.Unknown,
			type: TreeNodeType.File,
		},
		type: CodexLineType.File,
	};
}

function createChildSectionCodexIntendedTreeNode(
	nodeName: string,
	nodeNameChainToParent: string[],
	status: typeof TreeNodeStatus.Done | typeof TreeNodeStatus.NotStarted = TreeNodeStatus.NotStarted,
): AnyIntendedTreeNode {
	return {
		node: {
			nodeName,
			nodeNameChainToParent,
			status,
			type: TreeNodeType.Section,
		},
		type: CodexLineType.ChildSectionCodex,
	};
}

function createParentSectionCodexIntendedTreeNode(
	nodeName: string,
	nodeNameChainToParent: string[],
): AnyIntendedTreeNode {
	return {
		node: {
			nodeName,
			nodeNameChainToParent,
			status: TreeNodeStatus.NotStarted,
			type: TreeNodeType.Section,
		},
		type: CodexLineType.ParentSectionCodex,
	};
}

describe("formatAsLine", () => {
	describe("Scroll", () => {
		it("formats scroll with not started status", () => {
			const intended = createScrollIntendedTreeNode("Note", ["A"]);
			const result = formatAsLine(intended);
			expect(result).toBe("- [ ] [[Note-A|Note]]");
		});

		it("formats scroll with done status", () => {
			const intended = createScrollIntendedTreeNode("DoneNote", ["A"], TreeNodeStatus.Done);
			const result = formatAsLine(intended);
			expect(result).toBe("- [x] [[DoneNote-A|DoneNote]]");
		});

		it("formats scroll with empty chain", () => {
			const intended = createScrollIntendedTreeNode("RootNote", []);
			const result = formatAsLine(intended);
			expect(result).toBe("- [ ] [[RootNote|RootNote]]");
		});

		it("formats scroll with deep chain", () => {
			const intended = createScrollIntendedTreeNode("DeepNote", ["A", "B", "C"]);
			const result = formatAsLine(intended);
			expect(result).toBe("- [ ] [[DeepNote-C-B-A|DeepNote]]");
		});
	});

	describe("File", () => {
		it("formats file with default extension", () => {
			const intended = createFileIntendedTreeNode("Document", ["A"]);
			const result = formatAsLine(intended);
			expect(result).toBe("- [[Document-A|Document]]");
		});

		it("formats file with custom extension", () => {
			const intended = createFileIntendedTreeNode("Image", ["A"], "png");
			const result = formatAsLine(intended);
			expect(result).toBe("- [[Image-A|Image]]");
		});

		it("formats file with empty chain", () => {
			const intended = createFileIntendedTreeNode("RootFile", []);
			const result = formatAsLine(intended);
			expect(result).toBe("- [[RootFile|RootFile]]");
		});
	});

	describe("ChildSectionCodex", () => {
		it("formats child section codex with not started status", () => {
			const intended = createChildSectionCodexIntendedTreeNode("Section", ["A"]);
			const result = formatAsLine(intended);
			expect(result).toBe("- [ ] [[__-Section-A|Section]]");
		});

		it("formats child section codex with done status", () => {
			const intended = createChildSectionCodexIntendedTreeNode(
				"DoneSection",
				["A"],
				TreeNodeStatus.Done,
			);
			const result = formatAsLine(intended);
			expect(result).toBe("- [x] [[__-DoneSection-A|DoneSection]]");
		});

		it("formats child section codex with empty chain (root)", () => {
			const intended = createChildSectionCodexIntendedTreeNode("RootSection", []);
			const result = formatAsLine(intended);
			expect(result).toBe("- [ ] [[__-RootSection|RootSection]]");
		});

		it("formats child section codex with deep chain", () => {
			const intended = createChildSectionCodexIntendedTreeNode("DeepSection", ["A", "B"]);
			const result = formatAsLine(intended);
			expect(result).toBe("- [ ] [[__-DeepSection-B-A|DeepSection]]");
		});
	});

	describe("ParentSectionCodex", () => {
		it("formats parent section codex", () => {
			const intended = createParentSectionCodexIntendedTreeNode("Parent", ["A"]);
			const result = formatAsLine(intended);
			expect(result).toBe("[[__-Parent-A|← Parent]]");
		});

		it("formats parent section codex with empty chain", () => {
			const intended = createParentSectionCodexIntendedTreeNode("Root", []);
			const result = formatAsLine(intended);
			expect(result).toBe("[[__-Root|← Root]]");
		});

		it("formats parent section codex with deep chain", () => {
			const intended = createParentSectionCodexIntendedTreeNode("DeepParent", ["A", "B"]);
			const result = formatAsLine(intended);
			expect(result).toBe("[[__-DeepParent-B-A|← DeepParent]]");
		});
	});
});

describe("tryParseAsIntendedTreeNode", () => {
	describe("Scroll", () => {
		it("parses scroll with not started checkbox", () => {
			const line = "- [ ] [[Note-A|Note]]";
			const result = tryParseAsIntendedTreeNode(line);
			expect(result.isOk()).toBe(true);
			if (result.isOk()) {
				const value = result.value;
				expect(value.type).toBe(CodexLineType.Scroll);
				expect(value.node.nodeName).toBe("Note");
				expect(value.node.nodeNameChainToParent).toEqual(["Library", "A"]);
				expect(value.node.status).toBe(TreeNodeStatus.NotStarted);
				expect(value.node.type).toBe(TreeNodeType.Scroll);
				expect((value.node as any).extension).toBe("md");
			}
		});

		it("parses scroll with done checkbox", () => {
			const line = "- [x] [[DoneNote-A|DoneNote]]";
			const result = tryParseAsIntendedTreeNode(line);
			expect(result.isOk()).toBe(true);
			if (result.isOk()) {
				const value = result.value;
				expect(value.type).toBe(CodexLineType.Scroll);
				expect(value.node.nodeName).toBe("DoneNote");
				expect(value.node.status).toBe(TreeNodeStatus.Done);
			}
		});

		it("parses scroll with empty chain", () => {
			const line = "- [ ] [[RootNote|RootNote]]";
			const result = tryParseAsIntendedTreeNode(line);
			expect(result.isOk()).toBe(true);
			if (result.isOk()) {
				expect(result.value.node.nodeNameChainToParent).toEqual(["Library"]);
			}
		});

		it("parses scroll with deep chain", () => {
			const line = "- [ ] [[DeepNote-C-B-A|DeepNote]]";
			const result = tryParseAsIntendedTreeNode(line);
			expect(result.isOk()).toBe(true);
			if (result.isOk()) {
				expect(result.value.node.nodeNameChainToParent).toEqual(["Library", "A", "B", "C"]);
			}
		});
	});

	describe("File", () => {
		it("parses file line", () => {
			const line = "- [[Document-A|Document]]";
			const result = tryParseAsIntendedTreeNode(line);
			expect(result.isOk()).toBe(true);
			if (result.isOk()) {
				const value = result.value;
				expect(value.type).toBe(CodexLineType.File);
				expect(value.node.nodeName).toBe("Document");
				expect(value.node.nodeNameChainToParent).toEqual(["Library", "A"]);
				expect(value.node.status).toBe(TreeNodeStatus.Unknown);
				expect(value.node.type).toBe(TreeNodeType.File);
			}
		});

		it("parses file with empty chain", () => {
			const line = "- [[RootFile|RootFile]]";
			const result = tryParseAsIntendedTreeNode(line);
			expect(result.isOk()).toBe(true);
			if (result.isOk()) {
				expect(result.value.node.nodeNameChainToParent).toEqual(["Library"]);
			}
		});
	});

	describe("ChildSectionCodex", () => {
		it("parses child section codex with not started checkbox", () => {
			const line = "- [ ] [[__-Section|Section]]";
			const result = tryParseAsIntendedTreeNode(line);
			expect(result.isOk()).toBe(true);
			if (result.isOk()) {
				const value = result.value;
				expect(value.type).toBe(CodexLineType.ChildSectionCodex);
				expect(value.node.nodeName).toBe("Section");
				expect(value.node.nodeNameChainToParent).toEqual(["Library"]);
				expect(value.node.status).toBe(TreeNodeStatus.NotStarted);
				expect(value.node.type).toBe(TreeNodeType.Section);
			}
		});

		it("parses child section codex with done checkbox", () => {
			const line = "- [x] [[__-DoneSection|DoneSection]]";
			const result = tryParseAsIntendedTreeNode(line);
			expect(result.isOk()).toBe(true);
			if (result.isOk()) {
				expect(result.value.node.status).toBe(TreeNodeStatus.Done);
			}
		});

		it("parses child section codex with chain", () => {
			const line = "- [ ] [[__-Section-B-A|Section]]";
			const result = tryParseAsIntendedTreeNode(line);
			expect(result.isOk()).toBe(true);
			if (result.isOk()) {
				expect(result.value.node.nodeNameChainToParent).toEqual(["Library", "A", "B"]);
			}
		});

		it("parses child section codex with root chain", () => {
			const line = "- [ ] [[__-Library|RootSection]]";
			const result = tryParseAsIntendedTreeNode(line);
			expect(result.isOk()).toBe(true);
			if (result.isOk()) {
				expect(result.value.node.nodeNameChainToParent).toEqual(["Library"]);
			}
		});
	});

	describe("ParentSectionCodex", () => {
		it("parses parent section codex from standalone backlink", () => {
			const line = "[[__-Parent|← Parent]]";
			const result = tryParseAsIntendedTreeNode(line);
			expect(result.isOk()).toBe(true);
			if (result.isOk()) {
				const value = result.value;
				expect(value.type).toBe(CodexLineType.ParentSectionCodex);
				expect(value.node.nodeName).toBe("Parent");
				expect(value.node.nodeNameChainToParent).toEqual(["Library"]);
				expect(value.node.status).toBe(TreeNodeStatus.NotStarted);
				expect(value.node.type).toBe(TreeNodeType.Section);
			}
		});

		it("parses parent section codex with chain", () => {
			const line = "[[__-Parent-B-A|← Parent]]";
			const result = tryParseAsIntendedTreeNode(line);
			expect(result.isOk()).toBe(true);
			if (result.isOk()) {
				expect(result.value.node.nodeNameChainToParent).toEqual(["Library", "A", "B"]);
			}
		});

		it("parses parent section codex with root chain", () => {
			const line = "[[__-Root|← Root]]";
			const result = tryParseAsIntendedTreeNode(line);
			expect(result.isOk()).toBe(true);
			if (result.isOk()) {
				expect(result.value.node.nodeNameChainToParent).toEqual(["Library"]);
			}
		});
	});

	describe("error cases", () => {
		it("returns error for invalid format", () => {
			const line = "invalid line";
			const result = tryParseAsIntendedTreeNode(line as any);
			expect(result.isErr()).toBe(true);
		});

		it("returns error for missing space after checkbox", () => {
			const line = "- [ ][[Note|Note]]";
			const result = tryParseAsIntendedTreeNode(line as any);
			expect(result.isErr()).toBe(true);
		});

		it("returns error for missing space after dash", () => {
			const line = "-[[Note|Note]]";
			const result = tryParseAsIntendedTreeNode(line as any);
			expect(result.isErr()).toBe(true);
		});

		it("returns error for invalid backlink format", () => {
			const line = "- [ ] Note|Note";
			const result = tryParseAsIntendedTreeNode(line as any);
			expect(result.isErr()).toBe(true);
		});
	});
});

describe("roundtrip tests", () => {
	it("roundtrips scroll with not started status", () => {
		const intended = createScrollIntendedTreeNode("Note", ["Library", "A"]);
		const line = formatAsLine(intended);
		const result = tryParseAsIntendedTreeNode(line);
		expect(result.isOk()).toBe(true);
		if (result.isOk()) {
			const parsed = result.value;
			expect(parsed.type).toBe(intended.type);
			expect(parsed.node.nodeName).toBe(intended.node.nodeName);
			expect(parsed.node.nodeNameChainToParent).toEqual(intended.node.nodeNameChainToParent);
			expect(parsed.node.status).toBe(intended.node.status);
		}
	});

	it("roundtrips scroll with done status", () => {
		const intended = createScrollIntendedTreeNode("DoneNote", ["Library", "A"], TreeNodeStatus.Done);
		const line = formatAsLine(intended);
		const result = tryParseAsIntendedTreeNode(line);
		expect(result.isOk()).toBe(true);
		if (result.isOk()) {
			expect(result.value.node.status).toBe(TreeNodeStatus.Done);
		}
	});

	it("roundtrips file", () => {
		const intended = createFileIntendedTreeNode("Document", ["Library", "A"], "pdf");
		const line = formatAsLine(intended);
		const result = tryParseAsIntendedTreeNode(line);
		expect(result.isOk()).toBe(true);
		if (result.isOk()) {
			const parsed = result.value;
			expect(parsed.type).toBe(intended.type);
			expect(parsed.node.nodeName).toBe(intended.node.nodeName);
			expect(parsed.node.nodeNameChainToParent).toEqual(intended.node.nodeNameChainToParent);
		}
	});

	it("roundtrips child section codex", () => {
		const intended = createChildSectionCodexIntendedTreeNode("Section", ["Library", "A"]);
		const line = formatAsLine(intended);
		const result = tryParseAsIntendedTreeNode(line);
		expect(result.isOk()).toBe(true);
		if (result.isOk()) {
			const parsed = result.value;
			expect(parsed.type).toBe(intended.type);
			expect(parsed.node.nodeName).toBe(intended.node.nodeName);
			expect(parsed.node.nodeNameChainToParent).toEqual(intended.node.nodeNameChainToParent);
			expect(parsed.node.status).toBe(intended.node.status);
		}
	});

	it("roundtrips parent section codex", () => {
		const intended = createParentSectionCodexIntendedTreeNode("Parent", ["Library", "A"]);
		const line = formatAsLine(intended);
		const result = tryParseAsIntendedTreeNode(line);
		expect(result.isOk()).toBe(true);
		if (result.isOk()) {
			const parsed = result.value;
			expect(parsed.type).toBe(intended.type);
			expect(parsed.node.nodeName).toBe(intended.node.nodeName);
			expect(parsed.node.nodeNameChainToParent).toEqual(intended.node.nodeNameChainToParent);
		}
	});

	it("roundtrips scroll with empty chain (library root only)", () => {
		const intended = createScrollIntendedTreeNode("RootNote", ["Library"]);
		const line = formatAsLine(intended);
		const result = tryParseAsIntendedTreeNode(line);
		expect(result.isOk()).toBe(true);
		if (result.isOk()) {
			expect(result.value.node.nodeNameChainToParent).toEqual(["Library"]);
		}
	});

	it("roundtrips with deep chain", () => {
		const intended = createScrollIntendedTreeNode("DeepNote", ["Library", "A", "B", "C"]);
		const line = formatAsLine(intended);
		const result = tryParseAsIntendedTreeNode(line);
		expect(result.isOk()).toBe(true);
		if (result.isOk()) {
			expect(result.value.node.nodeNameChainToParent).toEqual(["Library", "A", "B", "C"]);
		}
	});
});

