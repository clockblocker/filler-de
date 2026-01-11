import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import { codexImpactToActions } from "../../../../../src/commanders/librarian-new/library-tree/codex/codex-impact-to-actions";
import { mergeCodexImpacts } from "../../../../../src/commanders/librarian-new/library-tree/codex/merge-codex-impacts";
import { Healer } from "../../../../../src/commanders/librarian-new/library-tree/healer";
import { Tree } from "../../../../../src/commanders/librarian-new/library-tree/tree";
import {
	TreeNodeStatus,
	TreeNodeType,
} from "../../../../../src/commanders/librarian-new/library-tree/tree-node/types/atoms";
import type {
	ScrollNodeSegmentId,
	SectionNodeSegmentId,
} from "../../../../../src/commanders/librarian-new/library-tree/tree-node/types/node-segment-id";
import { SplitPathType } from "../../../../../src/managers/obsidian/vault-action-manager/types/split-path";
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
		const healer = new Healer(new Tree("Library"));
		const impacts: ReturnType<typeof healer.getHealingActionsFor>["codexImpact"][] = [];

		// Create a file at Library/grandpa/father/kid/Diary.md
		const createAction = {
			actionType: "Create" as const,
			initialStatus: TreeNodeStatus.NotStarted,
			observedSplitPath: {
				basename: "Diary-kid-father-grandpa",
				extension: "md" as const,
				pathParts: ["Library", "grandpa", "father", "kid"],
				type: SplitPathType.MdFile,
			},
			targetLocator: {
				segmentId: scroll("Diary"),
				segmentIdChainToParent: [
					sec("Library"),
					sec("grandpa"),
					sec("father"),
					sec("kid"),
				],
				targetType: TreeNodeType.Scroll,
			},
		};

		const result = healer.getHealingActionsFor(createAction);
		impacts.push(result.codexImpact);

		const mergedImpact = mergeCodexImpacts(impacts);

		const codexActions = codexImpactToActions(mergedImpact, healer);

		// Should have codexes for: Library, grandpa, father, kid
		const createCodexPaths = codexActions
			.filter((a) => a.type === "UpsertCodex")
			.map((a) => (a.payload as any).splitPath.pathParts.join("/"));

		expect(createCodexPaths).toContain("Library");
		expect(createCodexPaths).toContain("Library/grandpa");
		expect(createCodexPaths).toContain("Library/grandpa/father");
		expect(createCodexPaths).toContain("Library/grandpa/father/kid");
	});
});
