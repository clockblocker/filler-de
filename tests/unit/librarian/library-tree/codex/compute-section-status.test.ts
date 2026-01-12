import { describe, expect, it } from "bun:test";
import { computeSectionStatus } from "../../../../../src/commanders/librarian-new/healer/library-tree/codex/compute-section-status";
import {
	TreeNodeKind,
	TreeNodeStatus,
} from "../../../../../src/commanders/librarian-new/healer/library-tree/tree-node/types/atoms";
import type {
	ScrollNode,
	SectionNode,
} from "../../../../../src/commanders/librarian-new/healer/library-tree/tree-node/types/tree-node";
import type { NodeName } from "../../../../../src/commanders/librarian-new/types/schemas/node-name";

// Helpers
const scroll = (
	name: string,
	status: TreeNodeStatus = TreeNodeStatus.NotStarted,
): ScrollNode => ({
	extension: "md",
	kind: TreeNodeKind.Scroll,
	nodeName: name as NodeName,
	status,
});

const section = (
	name: string,
	children: Record<string, SectionNode | ScrollNode> = {},
): SectionNode => ({
	children: children as SectionNode["children"],
	kind: TreeNodeKind.Section,
	nodeName: name as NodeName,
});

describe("computeSectionStatus", () => {
	it("empty section → NotStarted", () => {
		const sec = section("empty");
		expect(computeSectionStatus(sec)).toBe(TreeNodeStatus.NotStarted);
	});

	it("all scrolls Done → Done", () => {
		const sec = section("all-done", {
			"Note1﹘Scroll﹘md": scroll("Note1", TreeNodeStatus.Done),
			"Note2﹘Scroll﹘md": scroll("Note2", TreeNodeStatus.Done),
		});
		expect(computeSectionStatus(sec)).toBe(TreeNodeStatus.Done);
	});

	it("mixed scrolls → NotStarted", () => {
		const sec = section("mixed", {
			"Note1﹘Scroll﹘md": scroll("Note1", TreeNodeStatus.Done),
			"Note2﹘Scroll﹘md": scroll("Note2", TreeNodeStatus.NotStarted),
		});
		expect(computeSectionStatus(sec)).toBe(TreeNodeStatus.NotStarted);
	});

	it("single NotStarted scroll → NotStarted", () => {
		const sec = section("single", {
			"Note﹘Scroll﹘md": scroll("Note", TreeNodeStatus.NotStarted),
		});
		expect(computeSectionStatus(sec)).toBe(TreeNodeStatus.NotStarted);
	});

	it("nested: all descendants Done → Done", () => {
		const sec = section("parent", {
			"child﹘Section﹘": section("child", {
				"Note﹘Scroll﹘md": scroll("Note", TreeNodeStatus.Done),
			}),
		});
		expect(computeSectionStatus(sec)).toBe(TreeNodeStatus.Done);
	});

	it("nested: one deep leaf NotStarted → NotStarted", () => {
		const sec = section("parent", {
			"child1﹘Section﹘": section("child1", {
				"Note1﹘Scroll﹘md": scroll("Note1", TreeNodeStatus.Done),
			}),
			"child2﹘Section﹘": section("child2", {
				"Note2﹘Scroll﹘md": scroll("Note2", TreeNodeStatus.NotStarted),
			}),
		});
		expect(computeSectionStatus(sec)).toBe(TreeNodeStatus.NotStarted);
	});

	it("deeply nested all Done → Done", () => {
		const sec = section("root", {
			"A﹘Section﹘": section("A", {
				"B﹘Section﹘": section("B", {
					"C﹘Section﹘": section("C", {
						"Note﹘Scroll﹘md": scroll("Note", TreeNodeStatus.Done),
					}),
				}),
			}),
		});
		expect(computeSectionStatus(sec)).toBe(TreeNodeStatus.Done);
	});

	it("section with only empty nested sections → NotStarted", () => {
		const sec = section("parent", {
			"empty﹘Section﹘": section("empty"),
		});
		expect(computeSectionStatus(sec)).toBe(TreeNodeStatus.NotStarted);
	});
});
