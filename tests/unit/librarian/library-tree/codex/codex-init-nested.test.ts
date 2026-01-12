import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import { Healer } from "../../../../../src/commanders/librarian-new/healer/healer";
import {
	makeCodecs,
	makeCodecRulesFromSettings,
} from "../../../../../src/commanders/librarian-new/healer/library-tree/codecs";
import { codexImpactToActions } from "../../../../../src/commanders/librarian-new/healer/library-tree/codex/codex-impact-to-actions";
import { mergeCodexImpacts } from "../../../../../src/commanders/librarian-new/healer/library-tree/codex/merge-codex-impacts";
import { Tree } from "../../../../../src/commanders/librarian-new/healer/library-tree/tree";
import { defaultSettingsForUnitTests } from "../../../common-utils/consts";
import {
	TreeNodeKind,
	TreeNodeStatus,
} from "../../../../../src/commanders/librarian-new/healer/library-tree/tree-node/types/atoms";
import type {
	ScrollNodeSegmentId,
	SectionNodeSegmentId,
} from "../../../../../src/commanders/librarian-new/healer/library-tree/tree-node/types/node-segment-id";
import { SplitPathKind } from "../../../../../src/managers/obsidian/vault-action-manager/types/split-path";
import { setupGetParsedUserSettingsSpy } from "../../../common-utils/setup-spy";

const sec = (name: string): SectionNodeSegmentId =>
	`${name}﹘Section﹘` as SectionNodeSegmentId;

const scroll = (name: string): ScrollNodeSegmentId =>
	`${name}﹘Scroll﹘md` as ScrollNodeSegmentId;

describe("Codex init for nested sections", () => {
	let getParsedUserSettingsSpy: ReturnType<typeof spyOn>;

	beforeEach(() => {
		getParsedUserSettingsSpy = setupGetParsedUserSettingsSpy();
	});

	afterEach(() => {
		getParsedUserSettingsSpy.mockRestore();
	});

	it("creates codexes for all ancestor sections", () => {
		const rules = makeCodecRulesFromSettings(defaultSettingsForUnitTests);
		const codecs = makeCodecs(rules);
		const healer = new Healer(new Tree("Library", codecs), codecs);
		const impacts: ReturnType<typeof healer.getHealingActionsFor>["codexImpact"][] = [];

		// Create a file at Library/grandpa/father/kid/Diary.md
		const createAction = {
			actionType: "Create" as const,
			initialStatus: TreeNodeStatus.NotStarted,
			observedSplitPath: {
				basename: "Diary-kid-father-grandpa",
				extension: "md" as const,
				kind: SplitPathKind.MdFile,
				pathParts: ["Library", "grandpa", "father", "kid"],
			},
			targetLocator: {
				segmentId: scroll("Diary"),
				segmentIdChainToParent: [
					sec("Library"),
					sec("grandpa"),
					sec("father"),
					sec("kid"),
				],
				targetKind: TreeNodeKind.Scroll,
			},
		};

		const result = healer.getHealingActionsFor(createAction);
		impacts.push(result.codexImpact);

		const mergedImpact = mergeCodexImpacts(impacts);

		const codexActions = codexImpactToActions(mergedImpact, healer);

		// Should have codexes for: Library, grandpa, father, kid
		const createCodexPaths = codexActions
			.filter((a) => a.kind === "UpsertCodex")
			.map((a) => (a.payload as any).splitPath.pathParts.join("/"));

		expect(createCodexPaths).toContain("Library");
		expect(createCodexPaths).toContain("Library/grandpa");
		expect(createCodexPaths).toContain("Library/grandpa/father");
		expect(createCodexPaths).toContain("Library/grandpa/father/kid");
	});
});
