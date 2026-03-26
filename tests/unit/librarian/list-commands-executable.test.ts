import { beforeEach, describe, expect, it } from "bun:test";
import type { SplitPathToMdFile } from "@textfresser/vault-action-manager/types/split-path";
import { SplitPathKind } from "@textfresser/vault-action-manager/types/split-path";
import {
	makeCodecRulesFromSettings,
	makeCodecs,
} from "../../../src/commanders/librarian/codecs";
import { makeCodexBasename } from "../../../src/commanders/librarian/healer/library-tree/codex/format-codex-line";
import { listCommandsExecutableIn } from "../../../src/commanders/librarian/list-commands-executable";
import type { NodeName } from "../../../src/commanders/librarian/types/schemas/node-name";
import { CommandKind } from "../../../src/managers/obsidian/command-executor";
import { defaultSettingsForUnitTests } from "../common-utils/consts";
import { setupGetParsedUserSettingsSpyWithHooks } from "../common-utils/setup-spy";
import { makeTree } from "./library-tree/tree-test-helpers";

let codecs: ReturnType<typeof makeCodecs>;

setupGetParsedUserSettingsSpyWithHooks();

beforeEach(() => {
	const rules = makeCodecRulesFromSettings(defaultSettingsForUnitTests);
	codecs = makeCodecs(rules);
});

describe("listCommandsExecutableIn", () => {
	it("offers prev and next navigation for ordinary library scrolls", () => {
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

		const commands = listCommandsExecutableIn(
			codecs,
			healer,
			makeScrollPath(["Library", "Challenge"], "03 Peddler's Produce I"),
		);

		expect(commands).toContain(CommandKind.GoToPrevPage);
		expect(commands).not.toContain(CommandKind.GoToNextPage);
		expect(commands).toContain(CommandKind.SplitToPages);
		expect(commands).toContain(CommandKind.SplitInBlocks);
	});

	it("shows only next navigation on a codex with direct files", () => {
		const healer = makeTree({
			children: {
				Challenge: {
					children: {
						"01 Beginner's Basics": { kind: "Scroll" },
					},
				},
			},
			libraryRoot: "Library",
		});

		const commands = listCommandsExecutableIn(
			codecs,
			healer,
			makeCodexPath(["Library", "Challenge"]),
		);

		expect(commands).not.toContain(CommandKind.GoToPrevPage);
		expect(commands).toContain(CommandKind.GoToNextPage);
		expect(commands).not.toContain(CommandKind.SplitToPages);
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
