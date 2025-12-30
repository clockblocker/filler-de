import { describe, expect, it } from "bun:test";
import { makeNodeSegmentId } from "../../../../../../src/commanders/librarian-new/library-tree/tree-node/codecs/node-and-segment-id/make-node-segment-id";
import { makeTreeNode } from "../../../../../../src/commanders/librarian-new/library-tree/tree-node/codecs/node-and-segment-id/optimistic-makers/make-tree-node";
import { tryParseTreeNode } from "../../../../../../src/commanders/librarian-new/library-tree/tree-node/codecs/node-and-segment-id/try-parse-tree-node";
import { TreeNodeStatus, TreeNodeType } from "../../../../../../src/commanders/librarian-new/library-tree/tree-node/types/atoms";
import type {
	FileNodeSegmentId,
	ScrollNodeSegmentId,
	SectionNodeSegmentId,
} from "../../../../../../src/commanders/librarian-new/library-tree/tree-node/types/node-segment-id";
import { NodeSegmentIdSeparator as Separator } from "../../../../../../src/commanders/librarian-new/library-tree/tree-node/types/node-segment-id";
import type {
	FileNode,
	ScrollNode,
	SectionNode,
} from "../../../../../../src/commanders/librarian-new/library-tree/tree-node/types/tree-node";

describe("makeNodeSegmentId", () => {
	it("creates segment ID for Section node", () => {
		const node: SectionNode = {
			children: {},
			nodeName: "MySection",
			type: TreeNodeType.Section,
		};
		const result = makeNodeSegmentId(node);
		expect(result).toBe(
			`MySection${Separator}${TreeNodeType.Section}${Separator}`,
		);
	});

	it("creates segment ID for Scroll node", () => {
		const node: ScrollNode = {
			extension: "md",
			nodeName: "MyScroll",
			status: TreeNodeStatus.Unknown,
			type: TreeNodeType.Scroll,
		};
		const result = makeNodeSegmentId(node);
		expect(result).toBe(
			`MyScroll${Separator}${TreeNodeType.Scroll}${Separator}md`,
		);
	});

	it("creates segment ID for File node", () => {
		const node: FileNode = {
			extension: "txt",
			nodeName: "MyFile",
			status: TreeNodeStatus.Unknown,
			type: TreeNodeType.File,
		};
		const result = makeNodeSegmentId(node);
		expect(result).toBe(
			`MyFile${Separator}${TreeNodeType.File}${Separator}txt`,
		);
	});
});

describe("makeTreeNode", () => {
	it("creates Section node from segment ID", () => {
		const segmentId = `MySection${Separator}${TreeNodeType.Section}${Separator}` as SectionNodeSegmentId;
		const result = makeTreeNode(segmentId);
		expect(result).toEqual({
			children: {},
			nodeName: "MySection",
			type: TreeNodeType.Section,
		});
	});

	it("creates Scroll node from segment ID", () => {
		const segmentId = `MyScroll${Separator}${TreeNodeType.Scroll}${Separator}md` as ScrollNodeSegmentId;
		const result = makeTreeNode(segmentId);
		expect(result).toEqual({
			extension: "md",
			nodeName: "MyScroll",
			status: TreeNodeStatus.Unknown,
			type: TreeNodeType.Scroll,
		});
	});

	it("creates File node from segment ID", () => {
		const segmentId = `MyFile${Separator}${TreeNodeType.File}${Separator}txt` as FileNodeSegmentId;
		const result = makeTreeNode(segmentId);
		expect(result).toEqual({
			extension: "txt",
			nodeName: "MyFile",
			status: TreeNodeStatus.Unknown,
			type: TreeNodeType.File,
		});
	});
});

describe("tryParseTreeNode", () => {
	it("parses valid Section segment ID", () => {
		const segmentId = `MySection${Separator}${TreeNodeType.Section}${Separator}`;
		const result = tryParseTreeNode(segmentId);
		expect(result.isOk()).toBe(true);
		if (result.isOk()) {
			expect(result.value).toEqual({
				children: {},
				nodeName: "MySection",
				type: TreeNodeType.Section,
			});
		}
	});

	it("parses valid Scroll segment ID", () => {
		const segmentId = `MyScroll${Separator}${TreeNodeType.Scroll}${Separator}md`;
		const result = tryParseTreeNode(segmentId);
		expect(result.isOk()).toBe(true);
		if (result.isOk()) {
			expect(result.value).toEqual({
				extension: "md",
				nodeName: "MyScroll",
				status: TreeNodeStatus.Unknown,
				type: TreeNodeType.Scroll,
			});
		}
	});

	it("parses valid File segment ID", () => {
		const segmentId = `MyFile${Separator}${TreeNodeType.File}${Separator}txt`;
		const result = tryParseTreeNode(segmentId);
		expect(result.isOk()).toBe(true);
		if (result.isOk()) {
			expect(result.value).toEqual({
				extension: "txt",
				nodeName: "MyFile",
				status: TreeNodeStatus.Unknown,
				type: TreeNodeType.File,
			});
		}
	});

	it("returns error for invalid segment ID", () => {
		const invalidId = "invalid-segment-id";
		const result = tryParseTreeNode(invalidId);
		expect(result.isErr()).toBe(true);
		if (result.isErr()) {
			expect(result.error).toBeTruthy();
		}
	});

	it("returns error for empty string", () => {
		const result = tryParseTreeNode("");
		expect(result.isErr()).toBe(true);
	});

	it("returns error for malformed segment ID", () => {
		const malformed = `MyNode${Separator}InvalidType${Separator}`;
		const result = tryParseTreeNode(malformed);
		expect(result.isErr()).toBe(true);
	});
});

describe("makeNodeSegmentId and makeTreeNode roundtrip", () => {
	it("roundtrips Section node", () => {
		const node: SectionNode = {
			children: {},
			nodeName: "TestSection",
			type: TreeNodeType.Section,
		};
		const segmentId = makeNodeSegmentId(node);
		const reconstructed = makeTreeNode(segmentId);
		expect(reconstructed).toEqual(node);
	});

	it("roundtrips Scroll node", () => {
		const node: ScrollNode = {
			extension: "md",
			nodeName: "TestScroll",
			status: TreeNodeStatus.Unknown,
			type: TreeNodeType.Scroll,
		};
		const segmentId = makeNodeSegmentId(node);
		const reconstructed = makeTreeNode(segmentId);
		expect(reconstructed).toEqual(node);
	});

	it("roundtrips File node", () => {
		const node: FileNode = {
			extension: ".pdf",
			nodeName: "TestFile",
			status: TreeNodeStatus.Unknown,
			type: TreeNodeType.File,
		};
		const segmentId = makeNodeSegmentId(node);
		const reconstructed = makeTreeNode(segmentId);
		expect(reconstructed).toEqual(node);
	});
});

describe("tryParseTreeNode and makeTreeNode consistency", () => {
	it("tryParseTreeNode produces same result as makeTreeNode for valid input", () => {
		const segmentId = `TestNode${Separator}${TreeNodeType.Scroll}${Separator}md` as ScrollNodeSegmentId;
		const parsed = tryParseTreeNode(segmentId);
		const direct = makeTreeNode(segmentId);
		expect(parsed.isOk()).toBe(true);
		if (parsed.isOk()) {
			expect(parsed.value).toEqual(direct);
		}
	});
});

