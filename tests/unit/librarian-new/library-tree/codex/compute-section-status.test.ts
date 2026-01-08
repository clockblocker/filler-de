import { describe, it, expect } from "bun:test";
import {
	TreeNodeStatus,
	TreeNodeType,
} from "../../../../../src/commanders/librarian-new/library-tree/tree-node/types/atoms";
import type {
	SectionNode,
	ScrollNode,
} from "../../../../../src/commanders/librarian-new/library-tree/tree-node/types/tree-node";
import type { NodeName } from "../../../../../src/commanders/librarian-new/types/schemas/node-name";
import { computeSectionStatus } from "../../../../../src/commanders/librarian-new/library-tree/codex/compute-section-status";

// Helpers
const scroll = (
	name: string,
	status: TreeNodeStatus = TreeNodeStatus.NotStarted,
): ScrollNode => ({
	nodeName: name as NodeName,
	type: TreeNodeType.Scroll,
	status,
	extension: "md",
});

const section = (
	name: string,
	children: Record<string, SectionNode | ScrollNode> = {},
): SectionNode => ({
	nodeName: name as NodeName,
	type: TreeNodeType.Section,
	children: children as SectionNode["children"],
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
