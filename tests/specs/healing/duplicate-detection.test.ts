/**
 * Duplicate detection verification tests for OrphanCodexScanner.
 * Verifies that OrphanCodexScanner:
 * - Detects codexes with wrong suffixes
 * - Detects duplicate codexes for same section
 * - Generates correct cleanup actions
 */

import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import {
	makeCodecRulesFromSettings,
	makeCodecs,
} from "../../../src/commanders/librarian-new/codecs";
import {
	OrphanCodexScanner,
	scanAndGenerateOrphanActions,
} from "../../../src/commanders/librarian-new/healer/orphan-codex-scanner";
import type { SplitPathToMdFileInsideLibrary } from "../../../src/commanders/librarian-new/codecs";
import { SplitPathKind } from "../../../src/managers/obsidian/vault-action-manager/types/split-path";
import type { NodeName } from "../../../src/commanders/librarian-new/types/schemas/node-name";
import { defaultSettingsForUnitTests } from "../../unit/common-utils/consts";
import { setupGetParsedUserSettingsSpy } from "../../unit/common-utils/setup-spy";
import { makeTree } from "../../unit/librarian/library-tree/tree-test-helpers";

let getParsedUserSettingsSpy: ReturnType<typeof spyOn>;

beforeEach(() => {
	getParsedUserSettingsSpy = setupGetParsedUserSettingsSpy();
});

afterEach(() => {
	getParsedUserSettingsSpy.mockRestore();
});

describe("OrphanCodexScanner", () => {
	describe("scan() detects wrong suffixes", () => {
		it("detects codex with incorrect suffix", () => {
			const healer = makeTree({
				children: {
					recipes: {},
				},
				libraryRoot: "Library" as NodeName,
			});
			const rules = makeCodecRulesFromSettings(defaultSettingsForUnitTests);
			const codecs = makeCodecs(rules);

			const scanner = new OrphanCodexScanner(healer, codecs);

			// A codex file with the wrong suffix
			const vaultPaths: SplitPathToMdFileInsideLibrary[] = [
				{
					basename: "__-recipes-WRONG", // Wrong suffix!
					extension: "md",
					kind: SplitPathKind.MdFile,
					pathParts: ["Library", "recipes"],
				},
			];

			const result = scanner.scan(vaultPaths);

			expect(result.orphans.length).toBe(1);
			expect(result.orphans[0].reason).toBe("wrong_suffix");
			expect(result.orphans[0].observedPath.basename).toBe("__-recipes-WRONG");
		});

		it("does not flag valid codex", () => {
			const healer = makeTree({
				children: {
					recipes: {},
				},
				libraryRoot: "Library" as NodeName,
			});
			const rules = makeCodecRulesFromSettings(defaultSettingsForUnitTests);
			const codecs = makeCodecs(rules);

			const scanner = new OrphanCodexScanner(healer, codecs);

			// A valid codex file
			const vaultPaths: SplitPathToMdFileInsideLibrary[] = [
				{
					basename: "__-recipes", // Correct suffix for recipes section
					extension: "md",
					kind: SplitPathKind.MdFile,
					pathParts: ["Library", "recipes"],
				},
			];

			const result = scanner.scan(vaultPaths);

			expect(result.orphans.length).toBe(0);
		});

		it("detects codex for non-existent section", () => {
			const healer = makeTree({
				children: {
					recipes: {},
				},
				libraryRoot: "Library" as NodeName,
			});
			const rules = makeCodecRulesFromSettings(defaultSettingsForUnitTests);
			const codecs = makeCodecs(rules);

			const scanner = new OrphanCodexScanner(healer, codecs);

			// A codex for a section that doesn't exist in the tree
			const vaultPaths: SplitPathToMdFileInsideLibrary[] = [
				{
					basename: "__-nonexistent",
					extension: "md",
					kind: SplitPathKind.MdFile,
					pathParts: ["Library", "nonexistent"], // Section doesn't exist
				},
			];

			const result = scanner.scan(vaultPaths);

			expect(result.orphans.length).toBe(1);
			expect(result.orphans[0].reason).toBe("missing_section");
		});
	});

	describe("scan() detects duplicates", () => {
		it("detects duplicate codexes for same section", () => {
			const healer = makeTree({
				children: {
					recipes: {},
				},
				libraryRoot: "Library" as NodeName,
			});
			const rules = makeCodecRulesFromSettings(defaultSettingsForUnitTests);
			const codecs = makeCodecs(rules);

			const scanner = new OrphanCodexScanner(healer, codecs);

			// Two codex files for the same section
			const vaultPaths: SplitPathToMdFileInsideLibrary[] = [
				{
					basename: "__-recipes",
					extension: "md",
					kind: SplitPathKind.MdFile,
					pathParts: ["Library", "recipes"],
				},
				{
					basename: "__-recipes", // Duplicate!
					extension: "md",
					kind: SplitPathKind.MdFile,
					pathParts: ["Library", "recipes"],
				},
			];

			const result = scanner.scan(vaultPaths);

			// First one is valid, second is duplicate
			expect(result.orphans.length).toBe(1);
			expect(result.orphans[0].reason).toBe("duplicate");
		});

		it("handles multiple sections with duplicates", () => {
			const healer = makeTree({
				children: {
					recipes: {},
					archive: {},
				},
				libraryRoot: "Library" as NodeName,
			});
			const rules = makeCodecRulesFromSettings(defaultSettingsForUnitTests);
			const codecs = makeCodecs(rules);

			const scanner = new OrphanCodexScanner(healer, codecs);

			const vaultPaths: SplitPathToMdFileInsideLibrary[] = [
				// Valid
				{
					basename: "__-recipes",
					extension: "md",
					kind: SplitPathKind.MdFile,
					pathParts: ["Library", "recipes"],
				},
				// Duplicate of recipes
				{
					basename: "__-recipes",
					extension: "md",
					kind: SplitPathKind.MdFile,
					pathParts: ["Library", "recipes"],
				},
				// Valid
				{
					basename: "__-archive",
					extension: "md",
					kind: SplitPathKind.MdFile,
					pathParts: ["Library", "archive"],
				},
				// Duplicate of archive
				{
					basename: "__-archive",
					extension: "md",
					kind: SplitPathKind.MdFile,
					pathParts: ["Library", "archive"],
				},
			];

			const result = scanner.scan(vaultPaths);

			expect(result.orphans.length).toBe(2);
			expect(result.orphans.every((o) => o.reason === "duplicate")).toBe(true);
		});
	});

	describe("generateCleanupActions()", () => {
		it("generates delete actions for orphaned codexes", () => {
			const healer = makeTree({
				children: {
					recipes: {},
				},
				libraryRoot: "Library" as NodeName,
			});
			const rules = makeCodecRulesFromSettings(defaultSettingsForUnitTests);
			const codecs = makeCodecs(rules);

			const scanner = new OrphanCodexScanner(healer, codecs);

			const orphanedPath: SplitPathToMdFileInsideLibrary = {
				basename: "__-recipes-WRONG",
				extension: "md",
				kind: SplitPathKind.MdFile,
				pathParts: ["Library", "recipes"],
			};

			const orphans = [
				{
					observedPath: orphanedPath,
					expectedPath: null,
					reason: "wrong_suffix" as const,
				},
			];

			const actions = scanner.generateCleanupActions(orphans);

			expect(actions.length).toBe(1);
			expect(actions[0].kind).toBe("DeleteMdFile");
			expect(actions[0].payload.splitPath.basename).toBe("__-recipes-WRONG");
		});

		it("generates delete actions for all orphans", () => {
			const healer = makeTree({
				children: {
					recipes: {},
				},
				libraryRoot: "Library" as NodeName,
			});
			const rules = makeCodecRulesFromSettings(defaultSettingsForUnitTests);
			const codecs = makeCodecs(rules);

			const scanner = new OrphanCodexScanner(healer, codecs);

			const orphans = [
				{
					observedPath: {
						basename: "__-recipes-WRONG",
						extension: "md",
						kind: SplitPathKind.MdFile,
						pathParts: ["Library", "recipes"],
					} as SplitPathToMdFileInsideLibrary,
					expectedPath: null,
					reason: "wrong_suffix" as const,
				},
				{
					observedPath: {
						basename: "__-duplicate",
						extension: "md",
						kind: SplitPathKind.MdFile,
						pathParts: ["Library", "recipes"],
					} as SplitPathToMdFileInsideLibrary,
					expectedPath: null,
					reason: "duplicate" as const,
				},
			];

			const actions = scanner.generateCleanupActions(orphans);

			expect(actions.length).toBe(2);
			expect(actions.every((a) => a.kind === "DeleteMdFile")).toBe(true);
		});
	});

	describe("scanAndGenerateOrphanActions() convenience function", () => {
		it("combines scan and action generation", () => {
			const healer = makeTree({
				children: {
					recipes: {},
				},
				libraryRoot: "Library" as NodeName,
			});
			const rules = makeCodecRulesFromSettings(defaultSettingsForUnitTests);
			const codecs = makeCodecs(rules);

			const vaultPaths: SplitPathToMdFileInsideLibrary[] = [
				// Valid codex
				{
					basename: "__-recipes",
					extension: "md",
					kind: SplitPathKind.MdFile,
					pathParts: ["Library", "recipes"],
				},
				// Orphan with wrong suffix
				{
					basename: "__-recipes-OLD",
					extension: "md",
					kind: SplitPathKind.MdFile,
					pathParts: ["Library", "recipes"],
				},
			];

			const result = scanAndGenerateOrphanActions(healer, codecs, vaultPaths);

			expect(result.scanResult.orphans.length).toBe(1);
			expect(result.cleanupActions.length).toBe(1);
			expect(result.cleanupActions[0].kind).toBe("DeleteMdFile");
		});

		it("returns empty arrays when no orphans", () => {
			const healer = makeTree({
				children: {
					recipes: {},
				},
				libraryRoot: "Library" as NodeName,
			});
			const rules = makeCodecRulesFromSettings(defaultSettingsForUnitTests);
			const codecs = makeCodecs(rules);

			// Only valid codexes
			const vaultPaths: SplitPathToMdFileInsideLibrary[] = [
				{
					basename: "__-recipes",
					extension: "md",
					kind: SplitPathKind.MdFile,
					pathParts: ["Library", "recipes"],
				},
			];

			const result = scanAndGenerateOrphanActions(healer, codecs, vaultPaths);

			expect(result.scanResult.orphans.length).toBe(0);
			expect(result.cleanupActions.length).toBe(0);
		});
	});

	describe("non-codex files", () => {
		it("ignores non-codex files", () => {
			const healer = makeTree({
				children: {
					recipes: {},
				},
				libraryRoot: "Library" as NodeName,
			});
			const rules = makeCodecRulesFromSettings(defaultSettingsForUnitTests);
			const codecs = makeCodecs(rules);

			const scanner = new OrphanCodexScanner(healer, codecs);

			// Regular markdown files, not codexes
			const vaultPaths: SplitPathToMdFileInsideLibrary[] = [
				{
					basename: "Note-recipes", // Not a codex (no __ prefix)
					extension: "md",
					kind: SplitPathKind.MdFile,
					pathParts: ["Library", "recipes"],
				},
				{
					basename: "AnotherNote",
					extension: "md",
					kind: SplitPathKind.MdFile,
					pathParts: ["Library"],
				},
			];

			const result = scanner.scan(vaultPaths);

			expect(result.scannedCount).toBe(0); // No codexes scanned
			expect(result.orphans.length).toBe(0);
		});
	});

	describe("nested sections", () => {
		it("handles nested section codexes correctly", () => {
			const healer = makeTree({
				children: {
					recipes: {
						children: {
							soup: {},
						},
					},
				},
				libraryRoot: "Library" as NodeName,
			});
			const rules = makeCodecRulesFromSettings(defaultSettingsForUnitTests);
			const codecs = makeCodecs(rules);

			const scanner = new OrphanCodexScanner(healer, codecs);

			// Valid nested codex
			const vaultPaths: SplitPathToMdFileInsideLibrary[] = [
				{
					basename: "__-soup-recipes", // Correct suffix for nested section
					extension: "md",
					kind: SplitPathKind.MdFile,
					pathParts: ["Library", "recipes", "soup"],
				},
			];

			const result = scanner.scan(vaultPaths);

			expect(result.orphans.length).toBe(0);
		});

		it("detects wrong suffix for nested codex", () => {
			const healer = makeTree({
				children: {
					recipes: {
						children: {
							soup: {},
						},
					},
				},
				libraryRoot: "Library" as NodeName,
			});
			const rules = makeCodecRulesFromSettings(defaultSettingsForUnitTests);
			const codecs = makeCodecs(rules);

			const scanner = new OrphanCodexScanner(healer, codecs);

			// Codex with wrong suffix (missing parent in suffix)
			const vaultPaths: SplitPathToMdFileInsideLibrary[] = [
				{
					basename: "__-soup", // Wrong! Should be __-soup-recipes
					extension: "md",
					kind: SplitPathKind.MdFile,
					pathParts: ["Library", "recipes", "soup"],
				},
			];

			const result = scanner.scan(vaultPaths);

			expect(result.orphans.length).toBe(1);
			expect(result.orphans[0].reason).toBe("wrong_suffix");
		});
	});
});
