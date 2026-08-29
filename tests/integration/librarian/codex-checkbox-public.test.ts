import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import {
	generateCodexContent,
	makeCodecRulesFromSettings,
	makeCodecs,
	type SectionNodeSegmentId,
} from "@textfresser/library-core";
import { UserEventKind } from "@textfresser/obsidian-event-layer";
import type { VaultScanPath } from "@textfresser/vault-action-manager";
import {
	SplitPathKind,
	type SplitPathToFile,
	type SplitPathToMdFile,
	type VaultAction,
	VaultActionKind,
} from "@textfresser/vault-action-manager";
import { Effect } from "effect";
import {
	Librarian,
	type LibrarianVam,
} from "../../../src/commanders/librarian/librarian";
import { defaultSettingsForUnitTests } from "../../unit/common-utils/consts";
import { setupGetParsedUserSettingsSpy } from "../../unit/common-utils/setup-spy";

let getParsedUserSettingsSpy: ReturnType<typeof spyOn>;

beforeEach(() => {
	getParsedUserSettingsSpy = setupGetParsedUserSettingsSpy();
});

afterEach(() => {
	getParsedUserSettingsSpy.mockRestore();
});

function sectionChain(...names: string[]): SectionNodeSegmentId[] {
	return names.map(
		(name) => `${name}﹘Section﹘` as SectionNodeSegmentId,
	);
}

function scroll(
	pathParts: string[],
	basename: string,
): VaultScanPath {
	return {
		basename,
		extension: "md",
		kind: SplitPathKind.MdFile,
		pathParts,
		read: () => Effect.succeed(""),
	};
}

function file(
	pathParts: string[],
	basename: string,
	extension: string,
): SplitPathToFile {
	return { basename, extension, kind: SplitPathKind.File, pathParts };
}

function makeHarness(initialFiles: VaultScanPath[]) {
	const dispatches: VaultAction[][] = [];
	const vam: LibrarianVam = {
		cd: () => Effect.void,
		dispatch: (actions: readonly VaultAction[]) =>
			Effect.sync(() => {
				dispatches.push([...actions]);
			}),
		getOpenedContent: () => Effect.succeed(""),
		mdPwd: () => Effect.succeed(null),
		scan: () =>
			Effect.succeed({
				counts: {
					folderCount: 1,
					markdownFileCount: initialFiles.filter(
						(path) => path.kind === SplitPathKind.MdFile,
					).length,
					otherFileCount: initialFiles.filter(
						(path) => path.kind === SplitPathKind.File,
					).length,
				},
				diagnostics: [],
				entries: initialFiles,
				kind: "Complete",
			}),
		subscribeToBulk: () => Effect.succeed({ close: Effect.void }),
	};

	return { dispatches, librarian: new Librarian(vam) };
}

function hasProcessActionFor(
	dispatches: readonly (readonly VaultAction[])[],
	expected: SplitPathToMdFile,
): boolean {
	return dispatches.flat().some(
		(action) =>
			action.kind === VaultActionKind.ProcessMdFile &&
			action.payload.splitPath.basename === expected.basename &&
			action.payload.splitPath.pathParts.join("/") ===
				expected.pathParts.join("/"),
	);
}

function codexContent(
	librarian: Librarian,
	chain: SectionNodeSegmentId[],
): string {
	const healer = librarian.getHealer();
	expect(healer).not.toBeNull();
	if (!healer) return "";
	const section = healer.findSection(chain);
	expect(section).toBeDefined();
	if (!section) return "";
	const codecs = makeCodecs(
		makeCodecRulesFromSettings(defaultSettingsForUnitTests),
	);
	return generateCodexContent(section, chain, codecs);
}

describe("Librarian checkbox-click public seam", () => {
	it("marks one Scroll Done and updates its ancestor Section status", async () => {
		const fishPath = ["Library", "Recipe", "Pie", "Fish"];
		const { dispatches, librarian } = makeHarness([
			scroll(fishPath, "Steps-Fish-Pie-Recipe"),
			file(fishPath, "Result_picture-Fish-Pie-Recipe", "jpg"),
		]);
		await Effect.runPromise(librarian.init());
		dispatches.length = 0;

		await Effect.runPromise(
			librarian.handleCodexCheckboxClick({
				checked: false,
				kind: UserEventKind.CheckboxClicked,
				lineContent: "[[Steps-Fish-Pie-Recipe|Steps]]",
				sourcePath: "Library/Recipe/Pie/Fish/__-Fish-Pie-Recipe.md",
			}),
		);

		expect(
			codexContent(
				librarian,
				sectionChain("Library", "Recipe", "Pie", "Fish"),
			),
		).toContain("- [x] [[Steps-Fish-Pie-Recipe|Steps]]");
		expect(
			codexContent(
				librarian,
				sectionChain("Library", "Recipe", "Pie"),
			),
		).toContain("- [x] [[__-Fish-Pie-Recipe|Fish]]");
		expect(
			hasProcessActionFor(dispatches, {
				basename: "Steps-Fish-Pie-Recipe",
				extension: "md",
				kind: SplitPathKind.MdFile,
				pathParts: fishPath,
			}),
		).toBe(true);

		await Effect.runPromise(librarian.unsubscribe());
	});

	it("marks every descendant Scroll Done when a Section is checked", async () => {
		const berryPath = ["Library", "Recipe", "Pie", "Berry"];
		const scrollNames = ["Ingredients", "Steps", "Renamed"];
		const { dispatches, librarian } = makeHarness(
			scrollNames.map((name) =>
				scroll(berryPath, `${name}-Berry-Pie-Recipe`),
			),
		);
		await Effect.runPromise(librarian.init());
		dispatches.length = 0;

		await Effect.runPromise(
			librarian.handleCodexCheckboxClick({
				checked: false,
				kind: UserEventKind.CheckboxClicked,
				lineContent: "[[__-Berry-Pie-Recipe|Berry]]",
				sourcePath: "Library/Recipe/Pie/__-Pie-Recipe.md",
			}),
		);

		const berryCodex = codexContent(
			librarian,
			sectionChain("Library", "Recipe", "Pie", "Berry"),
		);
		for (const name of scrollNames) {
			expect(berryCodex).toContain(
				`- [x] [[${name}-Berry-Pie-Recipe|${name}]]`,
			);
			expect(
				hasProcessActionFor(dispatches, {
					basename: `${name}-Berry-Pie-Recipe`,
					extension: "md",
					kind: SplitPathKind.MdFile,
					pathParts: berryPath,
				}),
			).toBe(true);
		}
		expect(
			codexContent(
				librarian,
				sectionChain("Library", "Recipe", "Pie"),
			),
		).toContain("- [x] [[__-Berry-Pie-Recipe|Berry]]");

		await Effect.runPromise(librarian.unsubscribe());
	});
});
