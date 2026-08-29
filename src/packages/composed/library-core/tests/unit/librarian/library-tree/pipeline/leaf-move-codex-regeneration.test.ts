import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	type spyOn,
} from "bun:test";
import type {
	FileRenamedVaultEvent,
	PossibleRootVaultEvent,
	VaultEvent,
} from "@textfresser/vault-action-manager";
import {
	MD,
	SplitPathKind,
	VaultEventKind,
} from "@textfresser/vault-action-manager";
import { generateChildrenList } from "../../../../../src/healer/library-tree/codex/generate-codex-content";
import type { ProcessCodexAction } from "../../../../../src/healer/library-tree/codex/types/codex-action";
import { TreeActionType } from "../../../../../src/healer/library-tree/tree-action/types/tree-action";
import type { LibraryBulk } from "../../../../../src/tree/library-scope";
import { setupGetParsedUserSettingsSpy } from "../../../common-utils/setup-spy";
import type { TreeShape } from "../tree-test-helpers";
import { createPersistentPipeline, processBulkEvent } from "./helpers";

let getParsedUserSettingsSpy: ReturnType<typeof spyOn>;

beforeEach(() => {
	getParsedUserSettingsSpy = setupGetParsedUserSettingsSpy();
});

afterEach(() => {
	getParsedUserSettingsSpy.mockRestore();
});

const spMdFile = (
	pathParts: string[],
	basename: string,
): {
	basename: string;
	extension: MD;
	kind: typeof SplitPathKind.MdFile;
	pathParts: string[];
} => ({
	basename,
	extension: MD,
	kind: SplitPathKind.MdFile,
	pathParts,
});

const evFileRenamed = (
	from: ReturnType<typeof spMdFile>,
	to: ReturnType<typeof spMdFile>,
): FileRenamedVaultEvent => ({
	from,
	kind: VaultEventKind.FileRenamed,
	to,
});

const bulk = ({
	events,
	roots,
}: {
	events?: VaultEvent[];
	roots?: PossibleRootVaultEvent[];
}): LibraryBulk => ({
	events: events ?? [],
	roots: roots ?? [],
});

function getProcessCodexAction(
	result: ReturnType<typeof processBulkEvent>,
	path: string,
): ProcessCodexAction | undefined {
	return result.recreationActions.find(
		(action): action is ProcessCodexAction =>
			action.kind === "ProcessCodex" &&
			action.payload.splitPath.pathParts.join("/") === path,
	);
}

describe("Leaf Move Codex Regeneration", () => {
	it("regenerates both old and new parent codex content for a leaf move", () => {
		const initialTree: TreeShape = {
			children: {
				Recipe: {
					children: {
						Pie: {
							children: {
								Berry: {
									children: {
										MoveByCli: { kind: "Scroll" },
									},
								},
								Fish: {
									children: {
										Steps: { kind: "Scroll" },
									},
								},
							},
						},
					},
				},
			},
			libraryRoot: "Library",
		};

		const state = createPersistentPipeline(initialTree);
		const bulkEvent = bulk({
			roots: [
				evFileRenamed(
					spMdFile(
						["Library", "Recipe", "Pie", "Berry"],
						"MoveByCli-Berry-Pie-Recipe",
					),
					spMdFile(
						["Library", "Recipe", "Pie", "Fish"],
						"MoveByCli-Berry-Pie-Recipe",
					),
				),
			],
		});

		const result = processBulkEvent(state, bulkEvent);

		expect(result.treeActions).toHaveLength(1);
		expect(result.treeActions[0]?.actionType).toBe(TreeActionType.Move);

		const berryCodex = getProcessCodexAction(
			result,
			"Library/Recipe/Pie/Berry",
		);
		const fishCodex = getProcessCodexAction(
			result,
			"Library/Recipe/Pie/Fish",
		);

		expect(berryCodex).toBeDefined();
		expect(fishCodex).toBeDefined();

		if (!berryCodex || !fishCodex) {
			return;
		}

		const berryContent = generateChildrenList(
			berryCodex.payload.section,
			berryCodex.payload.sectionChain,
			state.codecs,
		);
		const fishContent = generateChildrenList(
			fishCodex.payload.section,
			fishCodex.payload.sectionChain,
			state.codecs,
		);

		expect(berryContent).not.toContain("MoveByCli");
		expect(fishContent).toContain(
			"[[MoveByCli-Fish-Pie-Recipe|MoveByCli]]",
		);
	});
});
