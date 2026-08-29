import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	type spyOn,
} from "bun:test";
import {
	generateCodexContent,
	Healer,
	makeCodecRulesFromSettings,
	makeCodecs,
	makeNodeSegmentId,
	type NodeName,
	type SectionNodeSegmentId,
	Tree,
	TreeActionType,
	TreeNodeKind,
	TreeNodeStatus,
} from "@textfresser/library-core";
import { MD, SplitPathKind } from "@textfresser/vault-action-manager";
import { defaultSettingsForUnitTests } from "../unit/common-utils/consts";
import { setupGetParsedUserSettingsSpy } from "../unit/common-utils/setup-spy";

let getParsedUserSettingsSpy: ReturnType<typeof spyOn>;

beforeEach(() => {
	getParsedUserSettingsSpy = setupGetParsedUserSettingsSpy();
});

afterEach(() => {
	getParsedUserSettingsSpy.mockRestore();
});

function sectionId(name: string): SectionNodeSegmentId {
	return makeNodeSegmentId({
		children: {},
		kind: TreeNodeKind.Section,
		nodeName: name as NodeName,
	});
}

function scrollId(name: string) {
	return makeNodeSegmentId({
		extension: MD,
		kind: TreeNodeKind.Scroll,
		nodeName: name as NodeName,
		status: TreeNodeStatus.NotStarted,
	});
}

describe("Core Name rename through Codex generation", () => {
	it("shows only the final Core Name after consecutive renames", () => {
		const codecs = makeCodecs(
			makeCodecRulesFromSettings(defaultSettingsForUnitTests),
		);
		const healer = new Healer(
			new Tree("Library" as NodeName, codecs),
			codecs,
		);
		const ramenChain = ["Library", "Recipe", "Soup", "Ramen"].map(
			sectionId,
		);
		healer.ensureSectionChain(ramenChain);
		healer.getHealingActionsFor({
			actionType: TreeActionType.Create,
			observedSplitPath: {
				basename: "Untitled",
				extension: MD,
				kind: SplitPathKind.MdFile,
				pathParts: ["Library", "Recipe", "Soup", "Ramen"],
			},
			targetLocator: {
				segmentId: scrollId("Untitled"),
				segmentIdChainToParent: ramenChain,
				targetKind: TreeNodeKind.Scroll,
			},
		});

		const names = ["Untitled", "Draft", "Review", "Final"];
		for (let index = 0; index < names.length - 1; index += 1) {
			const current = names[index];
			const next = names[index + 1];
			expect(current).toBeDefined();
			expect(next).toBeDefined();
			if (!current || !next) continue;
			healer.getHealingActionsFor({
				actionType: TreeActionType.Rename,
				newNodeName: next as NodeName,
				targetLocator: {
					segmentId: scrollId(current),
					segmentIdChainToParent: ramenChain,
					targetKind: TreeNodeKind.Scroll,
				},
			});
		}

		const ramen = healer.findSection(ramenChain);
		expect(ramen).toBeDefined();
		if (!ramen) return;
		const codex = generateCodexContent(ramen, ramenChain, codecs);
		expect(codex).toContain("[[Final-Ramen-Soup-Recipe|Final]]");
		expect(codex).not.toMatch(/Untitled|Draft|Review/u);
	});
});
