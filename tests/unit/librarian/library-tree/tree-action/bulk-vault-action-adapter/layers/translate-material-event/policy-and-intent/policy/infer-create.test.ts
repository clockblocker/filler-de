import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import { inferCreatePolicy } from "../../../../../../../../../../src/commanders/librarian/healer/library-tree/tree-action/bulk-vault-action-adapter/layers/translate-material-event/policy-and-intent/policy/infer-create";
import { ChangePolicy } from "../../../../../../../../../../src/commanders/librarian/healer/library-tree/tree-action/bulk-vault-action-adapter/layers/translate-material-event/policy-and-intent/policy/types";
import { SplitPathKind } from "../../../../../../../../../../src/managers/obsidian/vault-action-manager/types/split-path";
import { defaultSettingsForUnitTests } from "../../../../../../../../common-utils/consts";
import { setupGetParsedUserSettingsSpy } from "../../../../../../../../common-utils/setup-spy";

let getParsedUserSettingsSpy: ReturnType<typeof spyOn>;

beforeEach(() => {
	getParsedUserSettingsSpy = setupGetParsedUserSettingsSpy({
		showScrollsInCodexesForDepth: 0,
	});
});

afterEach(() => {
	getParsedUserSettingsSpy.mockRestore();
});

// Helper: create library-scoped split paths
const spMdFile = (
	pathParts: string[],
	basename: string,
): { basename: string; pathParts: string[]; kind: typeof SplitPathKind.MdFile; extension: "md" } => ({
	basename,
	extension: "md",
	kind: SplitPathKind.MdFile,
	pathParts,
});

describe("inferCreatePolicy", () => {
	it("spMdFile([\"Library\"], \"Note-Child-Parent\") => NameKing", () => {
		const splitPath = spMdFile(["Library"], "Note-Child-Parent");
		const policy = inferCreatePolicy(splitPath);
		expect(policy).toBe(ChangePolicy.NameKing);
	});

	it("spMdFile([\"Library\", \"Parent\"], \"Note\") => PathKing (nested)", () => {
		const splitPath = spMdFile(["Library", "Parent"], "Note");
		const policy = inferCreatePolicy(splitPath);
		expect(policy).toBe(ChangePolicy.PathKing);
	});

	it("spMdFile([\"Library\", \"Parent\", \"Child\"], \"Note\") => PathKing (deeply nested)", () => {
		const splitPath = spMdFile(["Library", "Parent", "Child"], "Note");
		const policy = inferCreatePolicy(splitPath);
		expect(policy).toBe(ChangePolicy.PathKing);
	});
});

