import { describe, expect, it } from "bun:test";
import { makeCodecs } from "../../../../../../src/commanders/librarian-new/healer/library-tree/codecs";
import { makeCodecRulesFromSettings } from "../../../../../../src/commanders/librarian-new/healer/library-tree/codecs";
import { makeNodeSegmentId } from "../../../../../../src/commanders/librarian-new/healer/library-tree/tree-node/codecs/node-and-segment-id/make-node-segment-id";
import { makeTreeNode } from "../../../../../../src/commanders/librarian-new/healer/library-tree/tree-node/codecs/node-and-segment-id/optimistic-makers/make-tree-node";
import { makeTreeNodeCodecs } from "../../../../../../src/commanders/librarian-new/healer/library-tree/tree-node/codecs/node-and-segment-id";
import { tryParseTreeNode } from "../../../../../../src/commanders/librarian-new/healer/library-tree/tree-node/codecs/node-and-segment-id/try-parse-tree-node";
import { TreeNodeKind, TreeNodeStatus } from "../../../../../../src/commanders/librarian-new/healer/library-tree/tree-node/types/atoms";
import type {
	FileNodeSegmentId,
	ScrollNodeSegmentId,
	SectionNodeSegmentId,
} from "../../../../../../src/commanders/librarian-new/healer/library-tree/tree-node/types/node-segment-id";
import { NodeSegmentIdSeparator as Separator } from "../../../../../../src/commanders/librarian-new/healer/library-tree/tree-node/types/node-segment-id";
import type {
	FileNode,
	ScrollNode,
	SectionNode,
} from "../../../../../../src/commanders/librarian-new/healer/library-tree/tree-node/types/tree-node";
import { defaultSettingsForUnitTests } from "../../../../common-utils/consts";

describe("makeNodeSegmentId", () => {
	it("creates segment ID for Section node", () => {
		const node: SectionNode = {
			children: {},
			kind: TreeNodeKind.Section,
			nodeName: "MySection",
		};
		const result = makeNodeSegmentId(node);
		expect(result).toBe(
			`MySection${Separator}${TreeNodeKind.Section}${Separator}`,
		);
	});

	it("creates segment ID for Scroll node", () => {
		const node: ScrollNode = {
			extension: "md",
			kind: TreeNodeKind.Scroll,
			nodeName: "MyScroll",
			status: TreeNodeStatus.Unknown,
		};
		const result = makeNodeSegmentId(node);
		expect(result).toBe(
			`MyScroll${Separator}${TreeNodeKind.Scroll}${Separator}md`,
		);
	});

	it("creates segment ID for File node", () => {
		const node: FileNode = {
			extension: "txt",
			kind: TreeNodeKind.File,
			nodeName: "MyFile",
			status: TreeNodeStatus.Unknown,
		};
		const result = makeNodeSegmentId(node);
		expect(result).toBe(
			`MyFile${Separator}${TreeNodeKind.File}${Separator}txt`,
		);
	});
});

describe("makeTreeNode", () => {
	it("creates Section node from segment ID", () => {
		const segmentId = `MySection${Separator}${TreeNodeKind.Section}${Separator}` as SectionNodeSegmentId;
		const result = makeTreeNode(segmentId);
		expect(result).toEqual({
			children: {},
			kind: TreeNodeKind.Section,
			nodeName: "MySection",
		});
	});

	it("creates Scroll node from segment ID", () => {
		const segmentId = `MyScroll${Separator}${TreeNodeKind.Scroll}${Separator}md` as ScrollNodeSegmentId;
		const result = makeTreeNode(segmentId);
		expect(result).toEqual({
			extension: "md",
			kind: TreeNodeKind.Scroll,
			nodeName: "MyScroll",
			status: TreeNodeStatus.Unknown,
		});
	});

	it("creates File node from segment ID", () => {
		const segmentId = `MyFile${Separator}${TreeNodeKind.File}${Separator}txt` as FileNodeSegmentId;
		const result = makeTreeNode(segmentId);
		expect(result).toEqual({
			extension: "txt",
			kind: TreeNodeKind.File,
			nodeName: "MyFile",
			status: TreeNodeStatus.Unknown,
		});
	});
});

describe("tryParseTreeNode", () => {
	const rules = makeCodecRulesFromSettings(defaultSettingsForUnitTests);
	const codecs = makeCodecs(rules);
	const treeNodeCodecs = makeTreeNodeCodecs(codecs.segmentId);

	it("parses valid Section segment ID", () => {
		const segmentId = `MySection${Separator}${TreeNodeKind.Section}${Separator}`;
		const result = tryParseTreeNode(treeNodeCodecs, segmentId);
		expect(result.isOk()).toBe(true);
		if (result.isOk()) {
			expect(result.value).toEqual({
				children: {},
				kind: TreeNodeKind.Section,
				nodeName: "MySection",
			});
		}
	});

	it("parses valid Scroll segment ID", () => {
		const segmentId = `MyScroll${Separator}${TreeNodeKind.Scroll}${Separator}md`;
		const result = tryParseTreeNode(treeNodeCodecs, segmentId);
		expect(result.isOk()).toBe(true);
		if (result.isOk()) {
			expect(result.value).toEqual({
				extension: "md",
				kind: TreeNodeKind.Scroll,
				nodeName: "MyScroll",
				status: TreeNodeStatus.Unknown,
			});
		}
	});

	it("parses valid File segment ID", () => {
		const segmentId = `MyFile${Separator}${TreeNodeKind.File}${Separator}txt`;
		const result = tryParseTreeNode(treeNodeCodecs, segmentId);
		expect(result.isOk()).toBe(true);
		if (result.isOk()) {
			expect(result.value).toEqual({
				extension: "txt",
				kind: TreeNodeKind.File,
				nodeName: "MyFile",
				status: TreeNodeStatus.Unknown,
			});
		}
	});

	it("returns error for invalid segment ID", () => {
		const invalidId = "invalid-segment-id";
		const result = tryParseTreeNode(treeNodeCodecs, invalidId);
		expect(result.isErr()).toBe(true);
		if (result.isErr()) {
			expect(result.error).toBeTruthy();
		}
	});

	it("returns error for empty string", () => {
		const result = tryParseTreeNode(treeNodeCodecs, "");
		expect(result.isErr()).toBe(true);
	});

	it("returns error for malformed segment ID", () => {
		const malformed = `MyNode${Separator}InvalidType${Separator}`;
		const result = tryParseTreeNode(treeNodeCodecs, malformed);
		expect(result.isErr()).toBe(true);
	});
});

describe("makeNodeSegmentId and makeTreeNode roundtrip", () => {
	it("roundtrips Section node", () => {
		const node: SectionNode = {
			children: {},
			kind: TreeNodeKind.Section,
			nodeName: "TestSection",
		};
		const segmentId = makeNodeSegmentId(node);
		const reconstructed = makeTreeNode(segmentId);
		expect(reconstructed).toEqual(node);
	});

	it("roundtrips Scroll node", () => {
		const node: ScrollNode = {
			extension: "md",
			kind: TreeNodeKind.Scroll,
			nodeName: "TestScroll",
			status: TreeNodeStatus.Unknown,
		};
		const segmentId = makeNodeSegmentId(node);
		const reconstructed = makeTreeNode(segmentId);
		expect(reconstructed).toEqual(node);
	});

	it("roundtrips File node", () => {
		const node: FileNode = {
			extension: ".pdf",
			kind: TreeNodeKind.File,
			nodeName: "TestFile",
			status: TreeNodeStatus.Unknown,
		};
		const segmentId = makeNodeSegmentId(node);
		const reconstructed = makeTreeNode(segmentId);
		expect(reconstructed).toEqual(node);
	});
});

describe("tryParseTreeNode and makeTreeNode consistency", () => {
	const rules = makeCodecRulesFromSettings(defaultSettingsForUnitTests);
	const codecs = makeCodecs(rules);
	const treeNodeCodecs = makeTreeNodeCodecs(codecs.segmentId);

	it("tryParseTreeNode produces same result as makeTreeNode for valid input", () => {
		const segmentId = `TestNode${Separator}${TreeNodeKind.Scroll}${Separator}md` as ScrollNodeSegmentId;
		const parsed = tryParseTreeNode(treeNodeCodecs, segmentId);
		const direct = makeTreeNode(segmentId);
		expect(parsed.isOk()).toBe(true);
		if (parsed.isOk()) {
			expect(parsed.value).toEqual(direct);
		}
	});
});

