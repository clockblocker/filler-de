/// <reference types="@wdio/globals/types" />
import { browser } from "@wdio/globals";
import { obsidianPage } from "wdio-obsidian-service";
import { testCollapseCreateWriteMerge } from "./dispatcher/collapse-create-write-merge.test";
import { testCollapseMultipleFiles } from "./dispatcher/collapse-multiple-files.test";
import { testCollapseProcessComposition } from "./dispatcher/collapse-process-composition.test";
import { testCollapseProcessWrite } from "./dispatcher/collapse-process-write.test";
import { testCollapseTrashTerminality } from "./dispatcher/collapse-trash-terminality.test";
import { testCollapseWritePrecedence } from "./dispatcher/collapse-write-precedence.test";
import { testCollapseWriteProcess } from "./dispatcher/collapse-write-process.test";
import { testComplexScenario } from "./dispatcher/complex-scenario.test";
import { testEmptyActions } from "./dispatcher/empty-actions.test";
import { testErrorHandlingSingle } from "./dispatcher/error-handling-single.test";
import {
	testCreateFileWithMissingParentFolders,
	testCreateFolderWithMissingParents,
	testMultipleNestedOperations,
	testProcessMdFileWithEnsureFileExists,
	testProcessMdFileWithMissingParentFolders,
	testUpsertMdFileWithEnsureFileExists,
	testUpsertMdFileWithMissingParentFolders,
} from "./dispatcher/helper-events-no-leak.test";
import { testQueueBehavior } from "./dispatcher/queue-behavior.test";
import { testSelfEventFiltering } from "./dispatcher/self-event-filtering.test";
import { testSingleActionHappyPath } from "./dispatcher/single-action-happy.test";
import { testSortingWeightOrder } from "./dispatcher/sorting-weight-order.test";
import { testUserEventEmission } from "./dispatcher/user-event-emission.test";
import { VAULT_PATH } from "./dispatcher/utils";

describe("Dispatcher", () => {
	beforeEach(async () => {
		await obsidianPage.resetVault(VAULT_PATH);
		await browser.executeObsidian(async ({ app }) => {
			await (app as any).commands.executeCommandById(
				"textfresser-testing-expose-opened-service",
			);
		});
	});

	describe("Empty Actions", () => {
		it("should handle empty actions array", testEmptyActions);
	});

	describe("Single Action - Happy Path", () => {
		it("should dispatch single action and create file", testSingleActionHappyPath);
	});

	describe("Collapse Integration", () => {
		it("should compose multiple processes", testCollapseProcessComposition);
		it("should collapse multiple writes to latest", testCollapseWritePrecedence);
		it("should apply process to write content", testCollapseWriteProcess);
		it("should discard process when write comes after", testCollapseProcessWrite);
		it("should trash win over all operations", testCollapseTrashTerminality);
		it("should merge create with write", testCollapseCreateWriteMerge);
		it("should keep operations on different files separate", testCollapseMultipleFiles);
	});

	describe("Sorting Integration", () => {
		it("should sort actions by weight", testSortingWeightOrder);
	});

	describe("Error Handling", () => {
		it("should collect single error and continue", testErrorHandlingSingle);
	});

	describe("Complex Scenarios", () => {
		it("should handle collapse + sort + execute", testComplexScenario);
	});

	describe("Self-Event Filtering", () => {
		it("should filter self-events from dispatched actions", testSelfEventFiltering);
	});

	describe("User Event Emission", () => {
		it("should emit events for user-triggered file changes", testUserEventEmission);
	});

	describe("Queue Behavior", () => {
		it("should batch and execute multiple dispatches", testQueueBehavior);
	});

	describe("Helper Events - No Leak", () => {
		it(
			"should not emit events when creating file with missing parent folders",
			testCreateFileWithMissingParentFolders,
		);
		it(
			"should not emit events when creating folder with missing parents",
			testCreateFolderWithMissingParents,
		);
		it(
			"should not emit events when ProcessMdFile ensures file exists",
			testProcessMdFileWithEnsureFileExists,
		);
		it(
			"should not emit events when ProcessMdFile creates file in missing folders",
			testProcessMdFileWithMissingParentFolders,
		);
		it(
			"should not emit events when UpsertMdFile ensures file exists",
			testUpsertMdFileWithEnsureFileExists,
		);
		it(
			"should not emit events when UpsertMdFile creates file in missing folders",
			testUpsertMdFileWithMissingParentFolders,
		);
		it(
			"should not emit events for multiple nested operations",
			testMultipleNestedOperations,
		);
	});
});
