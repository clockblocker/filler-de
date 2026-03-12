import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import { generateChildrenList } from "../../../../../src/commanders/librarian/healer/library-tree/codex/generate-codex-content";
import type { ProcessCodexAction } from "../../../../../src/commanders/librarian/healer/library-tree/codex/types/codex-action";
import { TreeActionType } from "../../../../../src/commanders/librarian/healer/library-tree/tree-action/types/tree-action";
import type { BulkVaultEvent } from "../../../../../src/managers/obsidian/vault-action-manager";
import type { PossibleRootVaultEvent } from "../../../../../src/managers/obsidian/vault-action-manager/impl/event-processing/bulk-event-emmiter/types/bulk/helpers";
import { MD } from "../../../../../src/managers/obsidian/vault-action-manager/types/literals";
import { SplitPathKind } from "../../../../../src/managers/obsidian/vault-action-manager/types/split-path";
import type {
	FileRenamedVaultEvent,
	VaultEvent,
} from "../../../../../src/managers/obsidian/vault-action-manager/types/vault-event";
import { VaultEventKind } from "../../../../../src/managers/obsidian/vault-action-manager/types/vault-event";
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
}): BulkVaultEvent => ({
	debug: {
		collapsedCount: { creates: 0, deletes: 0, renames: 0 },
		endedAt: 0,
		reduced: { rootDeletes: 0, rootRenames: 0 },
		startedAt: 0,
		trueCount: { creates: 0, deletes: 0, renames: 0 },
	},
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
		expect(fishContent).toContain("[[MoveByCli-Fish-Pie-Recipe|MoveByCli]]");
	});
});
