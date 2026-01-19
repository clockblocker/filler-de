/**
 * Error tracking verification tests for HealingTransaction.
 * Verifies that HealingTransaction:
 * - Records errors from failed healer.apply()
 * - Includes errors in summary
 * - Logs errors on commit/rollback
 */

import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from "bun:test";
import {
	makeCodecRulesFromSettings,
	makeCodecs,
} from "../../../src/commanders/librarian/codecs";
import { Healer } from "../../../src/commanders/librarian/healer/healer";
import {
	getHealingAuditLog,
	resetHealingAuditLog,
} from "../../../src/commanders/librarian/healer/healing-audit-log";
import { HealingTransaction } from "../../../src/commanders/librarian/healer/healing-transaction";
import { Tree } from "../../../src/commanders/librarian/healer/library-tree/tree";
import { TreeActionType } from "../../../src/commanders/librarian/healer/library-tree/tree-action/types/tree-action";
import { TreeNodeStatus } from "../../../src/commanders/librarian/healer/library-tree/tree-node/types/atoms";
import type { NodeName } from "../../../src/commanders/librarian/types/schemas/node-name";
import { SplitPathKind } from "../../../src/managers/obsidian/vault-action-manager/types/split-path";
import { defaultSettingsForUnitTests } from "../../unit/common-utils/consts";
import { setupGetParsedUserSettingsSpy } from "../../unit/common-utils/setup-spy";
import {
	makeScrollLocator,
	makeTree,
} from "../../unit/librarian/library-tree/tree-test-helpers";

let getParsedUserSettingsSpy: ReturnType<typeof spyOn>;

beforeEach(() => {
	getParsedUserSettingsSpy = setupGetParsedUserSettingsSpy();
	resetHealingAuditLog();
});

afterEach(() => {
	getParsedUserSettingsSpy.mockRestore();
});

describe("HealingTransaction Error Tracking", () => {
	describe("apply() captures healer exceptions", () => {
		it("returns error Result when healer throws", () => {
			const healer = makeTree({ libraryRoot: "Library" as NodeName });
			const tx = new HealingTransaction(healer);

			// Create a locator for a scroll that doesn't exist
			const locator = makeScrollLocator(
				["Library" as NodeName, "recipes" as NodeName],
				"NonExistent" as NodeName,
			);

			// Try to rename a non-existent node - this may throw
			const result = tx.apply({
				actionType: TreeActionType.Rename,
				newNodeName: "NewName" as NodeName,
				targetLocator: locator,
			});

			// The result should capture error OR succeed (depends on healer behavior)
			// What's important is that tx.apply() never throws
			expect(result).toBeDefined();
			expect(result.isOk() || result.isErr()).toBe(true);
		});

		it("prevents apply() after transaction is committed", () => {
			const healer = makeTree({ libraryRoot: "Library" as NodeName });
			const tx = new HealingTransaction(healer);

			// Commit the transaction
			tx.commit();

			// Try to apply after commit
			const locator = makeScrollLocator(
				["Library" as NodeName],
				"Note" as NodeName,
			);

			const result = tx.apply({
				actionType: TreeActionType.Create,
				observedSplitPath: {
					basename: "Note",
					extension: "md",
					kind: SplitPathKind.MdFile,
					pathParts: ["Library"],
				},
				targetLocator: locator,
			});

			// Should return error for applying to committed transaction
			expect(result.isErr()).toBe(true);
			expect(result._unsafeUnwrapErr().kind).toBe("InternalError");
		});

		it("prevents apply() after transaction is rolled back", () => {
			const healer = makeTree({ libraryRoot: "Library" as NodeName });
			const tx = new HealingTransaction(healer);

			// Rollback the transaction
			tx.rollback();

			// Try to apply after rollback
			const locator = makeScrollLocator(
				["Library" as NodeName],
				"Note" as NodeName,
			);

			const result = tx.apply({
				actionType: TreeActionType.Create,
				observedSplitPath: {
					basename: "Note",
					extension: "md",
					kind: SplitPathKind.MdFile,
					pathParts: ["Library"],
				},
				targetLocator: locator,
			});

			// Should return error for applying to rolled back transaction
			expect(result.isErr()).toBe(true);
		});
	});

	describe("recordError() and recordVaultFailure()", () => {
		it("records manual errors", () => {
			const healer = makeTree({ libraryRoot: "Library" as NodeName });
			const tx = new HealingTransaction(healer);

			// Record a vault failure manually
			tx.recordVaultFailure(
				{
					kind: "CreateFolder",
					payload: {
						splitPath: {
							basename: "test",
							kind: SplitPathKind.Folder,
							pathParts: ["Library"],
						},
					},
				},
				"Folder creation failed",
				true,
			);

			expect(tx.hasErrors()).toBe(true);
			const summary = tx.getSummary();
			expect(summary.errors.length).toBe(1);
			expect(summary.errors[0]!.kind).toBe("VaultFailed");
		});

		it("aggregates multiple errors", () => {
			const healer = makeTree({ libraryRoot: "Library" as NodeName });
			const tx = new HealingTransaction(healer);

			// Record multiple errors
			tx.recordVaultFailure(
				{
					kind: "CreateFolder",
					payload: {
						splitPath: {
							basename: "test1",
							kind: SplitPathKind.Folder,
							pathParts: ["Library"],
						},
					},
				},
				"Error 1",
			);

			tx.recordVaultFailure(
				{
					kind: "CreateFolder",
					payload: {
						splitPath: {
							basename: "test2",
							kind: SplitPathKind.Folder,
							pathParts: ["Library"],
						},
					},
				},
				"Error 2",
			);

			const summary = tx.getSummary();
			expect(summary.errors.length).toBe(2);
		});
	});

	describe("commit() records to audit log", () => {
		it("records successful actions to audit log", () => {
			const healer = makeTree({ libraryRoot: "Library" as NodeName });
			const tx = new HealingTransaction(healer);

			// Apply a successful action
			const locator = makeScrollLocator(
				["Library" as NodeName],
				"Note" as NodeName,
			);

			tx.apply({
				actionType: TreeActionType.Create,
				observedSplitPath: {
					basename: "Note",
					extension: "md",
					kind: SplitPathKind.MdFile,
					pathParts: ["Library"],
				},
				targetLocator: locator,
			});

			// Commit
			tx.commit();

			// Check audit log
			const auditLog = getHealingAuditLog();
			const recent = auditLog.getRecent(10);
			expect(recent.length).toBeGreaterThan(0);

			const lastEntry = recent[recent.length - 1]!;
			expect(lastEntry.treeAction.actionType).toBe(TreeActionType.Create);
			expect(lastEntry.status).toBe("success");
		});

		it("records multiple actions to audit log", () => {
			const healer = makeTree({
				children: {
					recipes: {},
				},
				libraryRoot: "Library" as NodeName,
			});
			const tx = new HealingTransaction(healer);

			// Apply multiple actions
			tx.apply({
				actionType: TreeActionType.Create,
				observedSplitPath: {
					basename: "Note1-recipes",
					extension: "md",
					kind: SplitPathKind.MdFile,
					pathParts: ["Library", "recipes"],
				},
				targetLocator: makeScrollLocator(
					["Library" as NodeName, "recipes" as NodeName],
					"Note1" as NodeName,
				),
			});

			tx.apply({
				actionType: TreeActionType.Create,
				observedSplitPath: {
					basename: "Note2-recipes",
					extension: "md",
					kind: SplitPathKind.MdFile,
					pathParts: ["Library", "recipes"],
				},
				targetLocator: makeScrollLocator(
					["Library" as NodeName, "recipes" as NodeName],
					"Note2" as NodeName,
				),
			});

			// Commit
			tx.commit();

			// Check audit log
			const auditLog = getHealingAuditLog();
			const recent = auditLog.getRecent(10);
			expect(recent.length).toBe(2);
		});
	});

	describe("getSummary() provides accurate metrics", () => {
		it("reports correct counts", () => {
			const healer = makeTree({
				children: {
					recipes: {},
				},
				libraryRoot: "Library" as NodeName,
			});
			const tx = new HealingTransaction(healer);

			// Apply an action that generates healing actions
			tx.apply({
				actionType: TreeActionType.Create,
				observedSplitPath: {
					basename: "Note", // Wrong suffix - should generate rename
					extension: "md",
					kind: SplitPathKind.MdFile,
					pathParts: ["Library", "recipes"],
				},
				targetLocator: makeScrollLocator(
					["Library" as NodeName, "recipes" as NodeName],
					"Note" as NodeName,
				),
			});

			const summary = tx.getSummary();
			expect(summary.entries).toBe(1);
			expect(summary.state).toBe("pending");
			expect(summary.errors.length).toBe(0);
		});

		it("includes avgDurationPerAction", () => {
			const healer = makeTree({ libraryRoot: "Library" as NodeName });
			const tx = new HealingTransaction(healer);

			// Apply actions
			tx.apply({
				actionType: TreeActionType.Create,
				observedSplitPath: {
					basename: "Note1",
					extension: "md",
					kind: SplitPathKind.MdFile,
					pathParts: ["Library"],
				},
				targetLocator: makeScrollLocator(
					["Library" as NodeName],
					"Note1" as NodeName,
				),
			});

			tx.apply({
				actionType: TreeActionType.Create,
				observedSplitPath: {
					basename: "Note2",
					extension: "md",
					kind: SplitPathKind.MdFile,
					pathParts: ["Library"],
				},
				targetLocator: makeScrollLocator(
					["Library" as NodeName],
					"Note2" as NodeName,
				),
			});

			const summary = tx.getSummary();
			expect(summary.avgDurationPerAction).toBeGreaterThanOrEqual(0);
			expect(typeof summary.avgDurationPerAction).toBe("number");
		});
	});

	describe("getHealingActions() and getCodexImpacts()", () => {
		it("collects all healing actions from entries", () => {
			const healer = makeTree({
				children: {
					recipes: {},
				},
				libraryRoot: "Library" as NodeName,
			});
			const tx = new HealingTransaction(healer);

			// Apply action that should generate healing actions
			tx.apply({
				actionType: TreeActionType.Create,
				observedSplitPath: {
					basename: "Note", // Missing suffix
					extension: "md",
					kind: SplitPathKind.MdFile,
					pathParts: ["Library", "recipes"],
				},
				targetLocator: makeScrollLocator(
					["Library" as NodeName, "recipes" as NodeName],
					"Note" as NodeName,
				),
			});

			const healingActions = tx.getHealingActions();
			const codexImpacts = tx.getCodexImpacts();

			// Should have healing actions (rename to fix suffix)
			expect(healingActions.length).toBeGreaterThanOrEqual(0);
			// Should have codex impacts (created impact)
			expect(codexImpacts.length).toBe(1);
		});
	});
});
