import { describe, expect, it } from "bun:test";
import {
	canConvertFolderToBook,
	sortBookSourceFiles,
} from "../../../../src/commanders/librarian/bookkeeper/folder-to-book-action";
import { makeCodecRulesFromSettings } from "../../../../src/commanders/librarian/codecs";
import {
	type AnySplitPath,
	SplitPathKind,
	type SplitPathToFolder,
	type SplitPathToMdFile,
} from "../../../../src/managers/obsidian/vault-action-manager/types/split-path";
import { defaultSettingsForUnitTests } from "../../common-utils/consts";

const rules = makeCodecRulesFromSettings(defaultSettingsForUnitTests);

function makeFolder(
	basename: string,
	pathParts: string[],
): SplitPathToFolder {
	return {
		basename,
		kind: SplitPathKind.Folder,
		pathParts,
	};
}

function makeMdFile(
	basename: string,
	pathParts: string[],
): SplitPathToMdFile {
	return {
		basename,
		extension: "md",
		kind: SplitPathKind.MdFile,
		pathParts,
	};
}

function makeBinaryFile(
	basename: string,
	pathParts: string[],
): AnySplitPath {
	return {
		basename,
		extension: "png",
		kind: SplitPathKind.File,
		pathParts,
	};
}

describe("folder-to-book-action", () => {
	describe("canConvertFolderToBook", () => {
		it("allows a library folder with direct markdown children", () => {
			const folder = makeFolder("Challenge", ["Library"]);

			expect(
				canConvertFolderToBook(folder, [makeMdFile("01 Intro-Challenge", ["Library", "Challenge"])], rules),
			).toBe(true);
		});

		it("allows non-markdown siblings when markdown files exist", () => {
			const folder = makeFolder("Challenge", ["Library"]);

			expect(
				canConvertFolderToBook(
					folder,
					[
						makeMdFile("01 Intro-Challenge", ["Library", "Challenge"]),
						makeBinaryFile("cover", ["Library", "Challenge"]),
					],
					rules,
				),
			).toBe(true);
		});

		it("rejects folders with child folders", () => {
			const folder = makeFolder("Challenge", ["Library"]);

			expect(
				canConvertFolderToBook(
					folder,
					[
						makeMdFile("01 Intro-Challenge", ["Library", "Challenge"]),
						makeFolder("Nested", ["Library", "Challenge"]),
					],
					rules,
				),
			).toBe(false);
		});

		it("rejects folders outside the configured library", () => {
			const folder = makeFolder("Challenge", ["Elsewhere"]);

			expect(
				canConvertFolderToBook(
					folder,
					[makeMdFile("01 Intro-Challenge", ["Elsewhere", "Challenge"])],
					rules,
				),
			).toBe(false);
		});
	});

	describe("sortBookSourceFiles", () => {
		it("uses unique leading numbers when every file has one", () => {
			const files = [
				makeMdFile("10 Atlas-Challenge", ["Library", "Challenge"]),
				makeMdFile("02 Mystery-Challenge", ["Library", "Challenge"]),
				makeMdFile("01 Beginning-Challenge", ["Library", "Challenge"]),
			];

			expect(sortBookSourceFiles(files).map((file) => file.basename)).toEqual([
				"01 Beginning-Challenge",
				"02 Mystery-Challenge",
				"10 Atlas-Challenge",
			]);
		});

		it("falls back to alphabetical order when any file lacks a leading number", () => {
			const files = [
				makeMdFile("10 Atlas-Challenge", ["Library", "Challenge"]),
				makeMdFile("Appendix-Challenge", ["Library", "Challenge"]),
				makeMdFile("02 Mystery-Challenge", ["Library", "Challenge"]),
			];

			expect(sortBookSourceFiles(files).map((file) => file.basename)).toEqual([
				"02 Mystery-Challenge",
				"10 Atlas-Challenge",
				"Appendix-Challenge",
			]);
		});

		it("falls back to alphabetical order when leading numbers repeat", () => {
			const files = [
				makeMdFile("01 Alpha-Challenge", ["Library", "Challenge"]),
				makeMdFile("01 Zeta-Challenge", ["Library", "Challenge"]),
				makeMdFile("02 Beta-Challenge", ["Library", "Challenge"]),
			];

			expect(sortBookSourceFiles(files).map((file) => file.basename)).toEqual([
				"01 Alpha-Challenge",
				"01 Zeta-Challenge",
				"02 Beta-Challenge",
			]);
		});
	});
});
