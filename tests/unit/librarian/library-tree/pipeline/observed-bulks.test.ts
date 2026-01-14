import { describe, expect, it } from "bun:test";
import { createActions } from "./observed-bulks/001-create";
import { bulkEvent as duplicateBulk } from "./observed-bulks/002-duplicate";
import { bulkEvent as renameBulk } from "./observed-bulks/003-rename";
import { bulkEvent as moveBulk } from "./observed-bulks/004-move";
import {
	createPipelineFromCreateActions,
	processBulkEvent,
} from "./helpers";

describe("Observed Bulk Events Pipeline", () => {
	it("processes create actions to initialize state", () => {
		const state = createPipelineFromCreateActions(createActions);

		expect(state.healer).toBeDefined();
		expect(state.history.length).toBe(0);
	});

	it("processes duplicate folder creation (002)", () => {
		const state = createPipelineFromCreateActions(createActions);
		const result = processBulkEvent(state, duplicateBulk);

		expect(result.treeActions.length).toBeGreaterThan(0);
		expect(result.deletionActions.length).toBeGreaterThanOrEqual(0);
		expect(result.recreationActions.length).toBeGreaterThan(0);
		expect(state.history.length).toBe(1);
	});

	it("processes folder rename (003)", () => {
		const state = createPipelineFromCreateActions(createActions);
		
		// First apply duplicate to get to the state before rename
		processBulkEvent(state, duplicateBulk);
		
		// Then apply rename
		const result = processBulkEvent(state, renameBulk);

		expect(result.treeActions.length).toBeGreaterThan(0);
		expect(result.deletionActions.length).toBeGreaterThanOrEqual(0);
		expect(result.recreationActions.length).toBeGreaterThan(0);
		expect(state.history.length).toBe(2);
	});

	it("processes folder move (004)", () => {
		const state = createPipelineFromCreateActions(createActions);
		
		// Apply duplicate and rename first
		processBulkEvent(state, duplicateBulk);
		processBulkEvent(state, renameBulk);
		
		// Then apply move
		const result = processBulkEvent(state, moveBulk);

		expect(result.treeActions.length).toBeGreaterThan(0);
		expect(result.deletionActions.length).toBeGreaterThanOrEqual(0);
		expect(result.recreationActions.length).toBeGreaterThan(0);
		expect(state.history.length).toBe(3);
	});

	it("processes full sequence: create → duplicate → rename → move", () => {
		const state = createPipelineFromCreateActions(createActions);
		
		const duplicateResult = processBulkEvent(state, duplicateBulk);
		const renameResult = processBulkEvent(state, renameBulk);
		const moveResult = processBulkEvent(state, moveBulk);

		// Verify each step produced actions
		expect(duplicateResult.treeActions.length).toBeGreaterThan(0);
		expect(renameResult.treeActions.length).toBeGreaterThan(0);
		expect(moveResult.treeActions.length).toBeGreaterThan(0);

		// Verify recreations are captured
		expect(duplicateResult.recreationActions.length).toBeGreaterThan(0);
		expect(renameResult.recreationActions.length).toBeGreaterThan(0);
		expect(moveResult.recreationActions.length).toBeGreaterThan(0);

		// Verify history
		expect(state.history.length).toBe(3);
	});
});
