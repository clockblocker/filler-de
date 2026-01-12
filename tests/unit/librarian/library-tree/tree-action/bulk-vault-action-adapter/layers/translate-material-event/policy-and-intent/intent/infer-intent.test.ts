import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import {
	type CodecRules,
	type Codecs,
	makeCodecRulesFromSettings,
	makeCodecs,
} from "../../../../../../../../../../src/commanders/librarian-new/codecs";
import { MaterializedEventKind } from "../../../../../../../../../../src/commanders/librarian-new/healer/library-tree/tree-action/bulk-vault-action-adapter/layers/materialized-node-events/types";
import { inferRenameIntent } from "../../../../../../../../../../src/commanders/librarian-new/healer/library-tree/tree-action/bulk-vault-action-adapter/layers/translate-material-event/policy-and-intent/intent/infer-intent";
import { RenameIntent } from "../../../../../../../../../../src/commanders/librarian-new/healer/library-tree/tree-action/bulk-vault-action-adapter/layers/translate-material-event/policy-and-intent/intent/types";
import { TreeNodeKind } from "../../../../../../../../../../src/commanders/librarian-new/healer/library-tree/tree-node/types/atoms";
import { SplitPathKind } from "../../../../../../../../../../src/managers/obsidian/vault-action-manager/types/split-path";
import { defaultSettingsForUnitTests } from "../../../../../../../../common-utils/consts";
import { setupGetParsedUserSettingsSpy } from "../../../../../../../../common-utils/setup-spy";

let getParsedUserSettingsSpy: ReturnType<typeof spyOn>;
let codecs: Codecs;
let rules: CodecRules;

beforeEach(() => {
	getParsedUserSettingsSpy = setupGetParsedUserSettingsSpy({
		showScrollsInCodexesForDepth: 0,
	});
	rules = makeCodecRulesFromSettings(defaultSettingsForUnitTests);
	codecs = makeCodecs(rules);
});

afterEach(() => {
	getParsedUserSettingsSpy.mockRestore();
});

describe("inferRenameIntent", () => {
	describe("basename unchanged => Move", () => {
		it("path-based move (drag)", () => {
			const result = inferRenameIntent(
				{
					from: {
						basename: "Note-A",
						extension: "md",
						kind: SplitPathKind.MdFile,
						pathParts: ["Library", "A"],
					},
					kind: MaterializedEventKind.Rename,
					nodeKind: TreeNodeKind.Scroll,
					to: {
						basename: "Note-A",
						extension: "md",
						kind: SplitPathKind.MdFile,
						pathParts: ["Library", "B"],
					},
				},
				codecs,
			);
			expect(result).toBe(RenameIntent.Move);
		});
	});

	describe("basename changed, suffix matches path => Rename", () => {
		it("coreName change only (suffix matches)", () => {
			const result = inferRenameIntent(
				{
					from: {
						basename: "Note-Test",
						extension: "md",
						kind: SplitPathKind.MdFile,
						pathParts: ["Library", "Test"],
					},
					kind: MaterializedEventKind.Rename,
					nodeKind: TreeNodeKind.Scroll,
					to: {
						basename: "NewNote-Test",
						extension: "md",
						kind: SplitPathKind.MdFile,
						pathParts: ["Library", "Test"],
					},
				},
				codecs,
			);
			expect(result).toBe(RenameIntent.Rename);
		});

		it("nested path, suffix matches", () => {
			const result = inferRenameIntent(
				{
					from: {
						basename: "Note-child-parent-Test",
						extension: "md",
						kind: SplitPathKind.MdFile,
						pathParts: ["Library", "Test", "parent", "child"],
					},
					kind: MaterializedEventKind.Rename,
					nodeKind: TreeNodeKind.Scroll,
					to: {
						basename: "NewNote-child-parent-Test",
						extension: "md",
						kind: SplitPathKind.MdFile,
						pathParts: ["Library", "Test", "parent", "child"],
					},
				},
				codecs,
			);
			expect(result).toBe(RenameIntent.Rename);
		});
	});

	describe("basename changed, no suffix => Rename", () => {
		it("root level file, no suffix", () => {
			const result = inferRenameIntent(
				{
					from: {
						basename: "Note",
						extension: "md",
						kind: SplitPathKind.MdFile,
						pathParts: ["Library"],
					},
					kind: MaterializedEventKind.Rename,
					nodeKind: TreeNodeKind.Scroll,
					to: {
						basename: "NewNote",
						extension: "md",
						kind: SplitPathKind.MdFile,
						pathParts: ["Library"],
					},
				},
				codecs,
			);
			expect(result).toBe(RenameIntent.Rename);
		});
	});

	describe("basename changed, suffix differs from path => Move", () => {
		it("suffix changed (child1 -> child2)", () => {
			const result = inferRenameIntent(
				{
					from: {
						basename: "Note-child1-parent-Test",
						extension: "md",
						kind: SplitPathKind.MdFile,
						pathParts: ["Library", "Test", "parent", "child1"],
					},
					kind: MaterializedEventKind.Rename,
					nodeKind: TreeNodeKind.Scroll,
					to: {
						basename: "Note-child2-parent-Test",
						extension: "md",
						kind: SplitPathKind.MdFile,
						pathParts: ["Library", "Test", "parent", "child1"],
					},
				},
				codecs,
			);
			expect(result).toBe(RenameIntent.Move);
		});

		it("suffix shortened (child1-parent-Test -> Test)", () => {
			const result = inferRenameIntent(
				{
					from: {
						basename: "Note-child1-parent-Test",
						extension: "md",
						kind: SplitPathKind.MdFile,
						pathParts: ["Library", "Test", "parent", "child1"],
					},
					kind: MaterializedEventKind.Rename,
					nodeKind: TreeNodeKind.Scroll,
					to: {
						basename: "Note-Test",
						extension: "md",
						kind: SplitPathKind.MdFile,
						pathParts: ["Library", "Test", "parent", "child1"],
					},
				},
				codecs,
			);
			expect(result).toBe(RenameIntent.Move);
		});

		it("new suffix added at root", () => {
			const result = inferRenameIntent(
				{
					from: {
						basename: "Note",
						extension: "md",
						kind: SplitPathKind.MdFile,
						pathParts: ["Library"],
					},
					kind: MaterializedEventKind.Rename,
					nodeKind: TreeNodeKind.Scroll,
					to: {
						basename: "Note-NewSection",
						extension: "md",
						kind: SplitPathKind.MdFile,
						pathParts: ["Library"],
					},
				},
				codecs,
			);
			expect(result).toBe(RenameIntent.Move);
		});
	});
});

