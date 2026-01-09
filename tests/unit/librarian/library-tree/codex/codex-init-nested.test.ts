import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import { codexImpactToActions } from "../../../../../src/commanders/librarian-new/library-tree/codex/codex-impact-to-actions";
import { mergeCodexImpacts } from "../../../../../src/commanders/librarian-new/library-tree/codex/merge-codex-impacts";
import { LibraryTree } from "../../../../../src/commanders/librarian-new/library-tree/library-tree";
import {
	TreeNodeStatus,
	TreeNodeType,
} from "../../../../../src/commanders/librarian-new/library-tree/tree-node/types/atoms";
import type {
	ScrollNodeSegmentId,
	SectionNodeSegmentId,
} from "../../../../../src/commanders/librarian-new/library-tree/tree-node/types/node-segment-id";
import * as globalState from "../../../../../src/global-state/global-state";
import type { ParsedUserSettings } from "../../../../../src/global-state/parsed-settings";
import { SplitPathType } from "../../../../../src/managers/obsidian/vault-action-manager/types/split-path";

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

const sec = (name: string): SectionNodeSegmentId =>
	`${name}﹘Section﹘` as SectionNodeSegmentId;

const scroll = (name: string): ScrollNodeSegmentId =>
	`${name}﹘Scroll﹘md` as ScrollNodeSegmentId;

describe("Codex init for nested sections", () => {
	let getParsedUserSettingsSpy: ReturnType<typeof spyOn>;

	beforeEach(() => {
		getParsedUserSettingsSpy = spyOn(
			globalState,
			"getParsedUserSettings",
		).mockReturnValue({ ...defaultSettings });
	});

	afterEach(() => {
		getParsedUserSettingsSpy.mockRestore();
	});

	it("creates codexes for all ancestor sections", () => {
		const tree = new LibraryTree("Library");
		const impacts: ReturnType<typeof tree.apply>["codexImpact"][] = [];

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

		const result = tree.apply(createAction);
		impacts.push(result.codexImpact);

		console.log(
			"Codex impact contentChanged:",
			result.codexImpact.contentChanged,
		);

		const mergedImpact = mergeCodexImpacts(impacts);
		console.log("Merged contentChanged:", mergedImpact.contentChanged);

		const codexActions = codexImpactToActions(mergedImpact, tree);
		console.log(
			"Codex actions:",
			codexActions.map((a) => ({
				path: (a.payload as any).splitPath?.pathParts,
				type: a.type,
			})),
		);

		// Should have codexes for: Library, grandpa, father, kid
		const createCodexPaths = codexActions
			.filter((a) => a.type === "UpsertCodex")
			.map((a) => (a.payload as any).splitPath.pathParts.join("/"));

		console.log("Create codex paths:", createCodexPaths);

		expect(createCodexPaths).toContain("Library");
		expect(createCodexPaths).toContain("Library/grandpa");
		expect(createCodexPaths).toContain("Library/grandpa/father");
		expect(createCodexPaths).toContain("Library/grandpa/father/kid");
	});
});
