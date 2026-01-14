import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import { setupGetParsedUserSettingsSpy } from "../../../common-utils/setup-spy";
import {
	createPipelineFromCreateActions,
	processBulkEvent,
} from "./helpers";
import { createActions } from "./observed-bulks/001-create";
import { bulkEvent as duplicateBulk } from "./observed-bulks/002-duplicate";
import { bulkEvent as renameBulk } from "./observed-bulks/003-rename";
import { bulkEvent as moveBulk } from "./observed-bulks/004-move";

let getParsedUserSettingsSpy: ReturnType<typeof spyOn>;

beforeEach(() => {
	getParsedUserSettingsSpy = setupGetParsedUserSettingsSpy();
});

afterEach(() => {
	getParsedUserSettingsSpy.mockRestore();
});

describe("Observed Bulk Events Pipeline", () => {
	it("processes all 4 bulk events sequentially on persistent state", () => {
		// Step 1: Initialize state from create actions
		const state = createPipelineFromCreateActions(createActions);
		expect(state.healer).toBeDefined();
		expect(state.history.length).toBe(0);

		// Step 2: Apply duplicate bulk (002)
		const duplicateResult = processBulkEvent(state, duplicateBulk);
		expect(duplicateResult.treeActions.length).toBeGreaterThan(0);
		expect(duplicateResult.recreationActions.length).toBeGreaterThan(0);
		expect(state.history.length).toBe(1);

		// Step 3: Apply rename bulk (003) - state preserved from step 2
		const renameResult = processBulkEvent(state, renameBulk);
		expect(renameResult.treeActions.length).toBeGreaterThan(0);
		expect(renameResult.recreationActions.length).toBeGreaterThan(0);
		expect(state.history.length).toBe(2);

		// Step 4: Apply move bulk (004) - state preserved from step 3
		const moveResult = processBulkEvent(state, moveBulk);
		expect(moveResult.treeActions.length).toBeGreaterThan(0);
		expect(moveResult.recreationActions.length).toBeGreaterThan(0);
		expect(state.history.length).toBe(3);

		// Verify all steps captured recreations
		expect(duplicateResult.recreationActions.length).toBeGreaterThan(0);
		expect(renameResult.recreationActions.length).toBeGreaterThan(0);
		expect(moveResult.recreationActions.length).toBeGreaterThan(0);
	});
});
