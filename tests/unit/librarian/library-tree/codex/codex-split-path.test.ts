import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import {
	makeCodecRulesFromSettings,
	makeCodecs,
} from "../../../../../src/commanders/librarian-new/codecs";
import type { SectionNodeSegmentId } from "../../../../../src/commanders/librarian-new/codecs/segment-id/types/segment-id";
import { computeCodexSplitPath } from "../../../../../src/commanders/librarian-new/healer/library-tree/codex/codex-split-path";
import { SplitPathKind } from "../../../../../src/managers/obsidian/vault-action-manager/types/split-path";
import { defaultSettingsForUnitTests } from "../../../common-utils/consts";
import { setupGetParsedUserSettingsSpy } from "../../../common-utils/setup-spy";

let getParsedUserSettingsSpy: ReturnType<typeof spyOn>;
let codecs: ReturnType<typeof makeCodecs>;

beforeEach(() => {
	getParsedUserSettingsSpy = setupGetParsedUserSettingsSpy();
	const rules = makeCodecRulesFromSettings(defaultSettingsForUnitTests);
	codecs = makeCodecs(rules);
});

afterEach(() => {
	getParsedUserSettingsSpy.mockRestore();
});

// Helper to create segment IDs for tests
const sec = (name: string): SectionNodeSegmentId =>
	`${name}﹘Section﹘` as SectionNodeSegmentId;

describe("computeCodexSplitPath", () => {
	it("root library codex → Library/__-Library", () => {
		const chain = [sec("Library")];
		const result = computeCodexSplitPath(chain, codecs);

		expect(result).toEqual({
			basename: "__-Library",
			extension: "md",
			kind: SplitPathKind.MdFile,
			pathParts: ["Library"],
		});
	});

	it("first-level section → Library/A/__-A", () => {
		const chain = [sec("Library"), sec("A")];
		const result = computeCodexSplitPath(chain, codecs);

		expect(result).toEqual({
			basename: "__-A",
			extension: "md",
			kind: SplitPathKind.MdFile,
			pathParts: ["Library", "A"],
		});
	});

	it("nested section → Library/A/B/__-B-A", () => {
		const chain = [sec("Library"), sec("A"), sec("B")];
		const result = computeCodexSplitPath(chain, codecs);

		expect(result).toEqual({
			basename: "__-B-A",
			extension: "md",
			kind: SplitPathKind.MdFile,
			pathParts: ["Library", "A", "B"],
		});
	});

	it("deeply nested → Library/A/B/C/__-C-B-A", () => {
		const chain = [sec("Library"), sec("A"), sec("B"), sec("C")];
		const result = computeCodexSplitPath(chain, codecs);

		expect(result).toEqual({
			basename: "__-C-B-A",
			extension: "md",
			kind: SplitPathKind.MdFile,
			pathParts: ["Library", "A", "B", "C"],
		});
	});

	it("throws on empty chain", () => {
		expect(() => computeCodexSplitPath([], codecs)).toThrow();
	});
});
