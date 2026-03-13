import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	spyOn,
} from "bun:test";
import {
	makeCodecRulesFromSettings,
	makeCodecs,
} from "../../../src/commanders/librarian/codecs";
import { makeCodexBasename } from "../../../src/commanders/librarian/healer/library-tree/codex/format-codex-line";
import {
	getNextPage,
	getPrevPage,
} from "../../../src/commanders/librarian/page-navigation";
import type { NodeName } from "../../../src/commanders/librarian/types/schemas/node-name";
import type { SplitPathToMdFile } from "../../../src/managers/obsidian/vault-action-manager/types/split-path";
import { SplitPathKind } from "../../../src/managers/obsidian/vault-action-manager/types/split-path";
import { defaultSettingsForUnitTests } from "../common-utils/consts";
import { setupGetParsedUserSettingsSpy } from "../common-utils/setup-spy";
import { makeTree } from "./library-tree/tree-test-helpers";

let codecs: ReturnType<typeof makeCodecs>;
let getParsedUserSettingsSpy: ReturnType<typeof spyOn>;

beforeEach(() => {
	getParsedUserSettingsSpy = setupGetParsedUserSettingsSpy();
	const rules = makeCodecRulesFromSettings(defaultSettingsForUnitTests);
	codecs = makeCodecs(rules);
});

afterEach(() => {
	getParsedUserSettingsSpy.mockRestore();
});

describe("page navigation", () => {
	it("navigates through library scrolls in sorted display order", () => {
		const healer = makeTree({
			children: {
				Challenge: {
					children: {
						"01 Beginner's Basics": { kind: "Scroll" },
						"03 Peddler's Produce I": { kind: "Scroll" },
					},
				},
				Zeta: { kind: "Scroll" },
			},
			libraryRoot: "Library",
		});

		const first = makeScrollPath([
			"Library",
			"Challenge",
		], "01 Beginner's Basics");
		const challengeCodex = makeCodexPath(["Library", "Challenge"]);
		const second = makeScrollPath([
			"Library",
			"Challenge",
		], "03 Peddler's Produce I");
		const rootCodex = makeCodexPath(["Library"]);
		const third = makeScrollPath(["Library"], "Zeta");

		expect(getPrevPage(healer, codecs, first)).toEqual(challengeCodex);
		expect(getNextPage(healer, codecs, first)).toEqual(second);
		expect(getPrevPage(healer, codecs, second)).toEqual(first);
		expect(getNextPage(healer, codecs, second)).toEqual(third);
		expect(getPrevPage(healer, codecs, third)).toEqual(rootCodex);
		expect(getNextPage(healer, codecs, third)).toBeNull();
	});

	it("puts numeric-prefixed scrolls before non-numeric ones", () => {
		const healer = makeTree({
			children: {
				Challenge: {
					children: {
						"02 Beginner's Basics": { kind: "Scroll" },
						"10 Atlas Additions": { kind: "Scroll" },
						Appendix: { kind: "Scroll" },
					},
				},
			},
			libraryRoot: "Library",
		});

		const first = makeScrollPath([
			"Library",
			"Challenge",
		], "02 Beginner's Basics");
		const second = makeScrollPath([
			"Library",
			"Challenge",
		], "10 Atlas Additions");
		const third = makeScrollPath(["Library", "Challenge"], "Appendix");

		expect(getNextPage(healer, codecs, first)).toEqual(second);
		expect(getNextPage(healer, codecs, second)).toEqual(third);
		expect(getPrevPage(healer, codecs, third)).toEqual(second);
	});

	it("navigates from the first direct file in a folder back to that folder's codex", () => {
		const healer = makeTree({
			children: {
				Alpha: { kind: "Scroll" },
				Challenge: {
					children: {
						"01 Beginner's Basics": { kind: "Scroll" },
						"03 Peddler's Produce I": { kind: "Scroll" },
					},
				},
			},
			libraryRoot: "Library",
		});

		const codex = makeCodexPath(["Library", "Challenge"]);
		const first = makeScrollPath([
			"Library",
			"Challenge",
		], "01 Beginner's Basics");

		expect(getPrevPage(healer, codecs, first)).toEqual(codex);
	});

	it("disables prev on codex and opens the first direct file on next", () => {
		const healer = makeTree({
			children: {
				Challenge: {
					children: {
						"01 Beginner's Basics": { kind: "Scroll" },
						"03 Peddler's Produce I": { kind: "Scroll" },
					},
				},
			},
			libraryRoot: "Library",
		});

		const codex = makeCodexPath(["Library", "Challenge"]);
		const first = makeScrollPath([
			"Library",
			"Challenge",
		], "01 Beginner's Basics");

		expect(getPrevPage(healer, codecs, codex)).toBeNull();
		expect(getNextPage(healer, codecs, codex)).toEqual(first);
	});
});

function makeScrollPath(
	pathParts: string[],
	nodeName: NodeName,
): SplitPathToMdFile {
	const suffixParts = codecs.suffix.pathPartsWithRootToSuffixParts(pathParts);
	const basenameResult = codecs.suffix.serializeSeparatedSuffixUnchecked({
		coreName: nodeName,
		suffixParts,
	});

	if (basenameResult.isErr()) {
		throw new Error("Failed to build test basename");
	}

	return {
		basename: basenameResult.value,
		extension: "md",
		kind: SplitPathKind.MdFile,
		pathParts,
	};
}

function makeCodexPath(pathParts: string[]): SplitPathToMdFile {
	return {
		basename: makeCodexBasename(pathParts),
		extension: "md",
		kind: SplitPathKind.MdFile,
		pathParts,
	};
}
