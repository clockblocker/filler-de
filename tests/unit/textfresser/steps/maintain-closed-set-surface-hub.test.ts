import { describe, expect, it } from "bun:test";
import { maintainClosedSetSurfaceHub } from "../../../../src/commanders/textfresser/commands/generate/steps/maintain-closed-set-surface-hub";
import type { CommandStateWithLemma } from "../../../../src/commanders/textfresser/commands/types";
import type { SplitPathToMdFile } from "../../../../src/managers/obsidian/vault-action-manager/types/split-path";
import { VaultActionKind } from "../../../../src/managers/obsidian/vault-action-manager/types/vault-action";

function makePath(
	basename: string,
	pathParts: string[],
): SplitPathToMdFile {
	return {
		basename,
		extension: "md",
		kind: "MdFile",
		pathParts,
	};
}

function makeCtx(params: {
	activePath: SplitPathToMdFile;
	isLibraryLookupAvailable: boolean;
	lookupInLibrary: (name: string) => SplitPathToMdFile[];
	vamExists: (splitPath: SplitPathToMdFile) => boolean;
}): CommandStateWithLemma {
	return {
		actions: [],
		commandContext: {
			activeFile: {
				content: "",
				splitPath: params.activePath,
			},
			selection: null,
		},
		resultingActions: [],
		textfresserState: {
			isLibraryLookupAvailable: params.isLibraryLookupAvailable,
			languages: { known: "English", target: "German" },
			latestLemmaResult: {
				attestation: {
					source: {
						path: makePath("Source", ["Books"]),
						ref: "![[Source#^1|^]]",
						textRaw: "Die Frau ...",
						textWithOnlyTargetMarked: "[Die] Frau ...",
					},
					target: {
						offsetInBlock: 0,
						surface: "Die",
					},
				},
				disambiguationResult: null,
				lemma: "die-pronoun-de",
				linguisticUnit: "Lexem",
				posLikeKind: "Pronoun",
				surfaceKind: "Lemma",
			},
			lookupInLibrary: params.lookupInLibrary,
			vam: {
				exists: params.vamExists,
			},
		},
	} as unknown as CommandStateWithLemma;
}

describe("maintainClosedSetSurfaceHub", () => {
	it("no-ops when library lookup is unavailable", () => {
		const currentTarget = makePath("die-pronoun-de", [
			"Library",
			"de",
			"pronoun",
		]);

		const result = maintainClosedSetSurfaceHub(
			makeCtx({
				activePath: currentTarget,
				isLibraryLookupAvailable: false,
				lookupInLibrary: () => [],
				vamExists: () => true,
			}),
		);

		expect(result.isOk()).toBe(true);
		if (result.isErr()) {
			throw new Error("Expected ok result");
		}
		expect(result.value.actions).toHaveLength(0);
	});

	it("plans hub actions when lookup is available", () => {
		const currentTarget = makePath("die-article-de", [
			"Library",
			"de",
			"article",
		]);
		const otherTarget = makePath("die-pronoun-de", [
			"Library",
			"de",
			"pronoun",
		]);

		const result = maintainClosedSetSurfaceHub(
			makeCtx({
				activePath: currentTarget,
				isLibraryLookupAvailable: true,
				lookupInLibrary: () => [otherTarget],
				vamExists: () => false,
			}),
		);

		expect(result.isOk()).toBe(true);
		if (result.isErr()) {
			throw new Error("Expected ok result");
		}
		expect(result.value.actions).toHaveLength(1);
		expect(result.value.actions[0]?.kind).toBe(VaultActionKind.UpsertMdFile);
	});
});
