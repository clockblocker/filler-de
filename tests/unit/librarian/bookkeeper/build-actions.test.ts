import { describe, expect, it } from "bun:test";
import {
	makeCodecRulesFromSettings,
} from "@textfresser/library-core";
import { Result } from "effect";
import {
	buildPageSplitActions,
} from "../../../../src/commanders/librarian/pages/build-actions";
import type { SegmentationResult } from "../../../../src/commanders/librarian/pages/types";
import {
	LibraryMetadata,
	noteMetadataHelper,
} from "../../../../src/stateless-helpers/note-metadata";
import { defaultSettingsForUnitTests } from "../../common-utils/consts";

describe("buildPageSplitActions", () => {
	it("does not write page adjacency metadata into split pages", () => {
		const rules = makeCodecRulesFromSettings(defaultSettingsForUnitTests);
		const result: SegmentationResult = {
			pages: [
				{ charCount: 10, content: "Page one", pageIndex: 0 },
				{ charCount: 10, content: "Page two", pageIndex: 1 },
			],
			sourceCoreName: "Story",
			sourceSuffix: ["LibrarySection"],
			tooShortToSplit: false,
		};

		const splitResult = buildPageSplitActions(
			result,
			{
				basename: "Story-LibrarySection",
				extension: "md",
				kind: "MdFile",
				pathParts: ["Library"],
			},
			rules,
		);
		expect(Result.isSuccess(splitResult)).toBe(true);
		if (Result.isFailure(splitResult)) throw new Error("Expected valid split plan");
		const split = splitResult.success;

		const firstAction = split.vaultActions[0];
		if (!firstAction || firstAction.kind !== "UpsertMdFile") {
			throw new Error("Expected first action to upsert first page");
		}
		if (typeof firstAction.payload.content !== "string") {
			throw new Error("Expected split page content to be materialized");
		}

		const metadata = noteMetadataHelper.read(
			firstAction.payload.content,
			LibraryMetadata, "Hidden",
		);
		expect(metadata).toEqual({ noteKind: "Page", status: "NotStarted" });
		expect(firstAction.payload.content).not.toContain("PageIdx");
		expect(split.treeActions.map((action) => action.actionType)).toEqual([
			"Delete",
			"Create",
			"Create",
		]);
		expect(split.treeActions.slice(1).map((action) => {
			if (action.actionType !== "Create") return null;
			return {
				path: action.observedSplitPath.pathParts,
				status: action.initialStatus,
			};
		})).toEqual([
			{ path: ["Library", "Story"], status: "NotStarted" },
			{ path: ["Library", "Story"], status: "NotStarted" },
		]);
	});

	it("keeps Tree paths Library-scoped below a nested vault prefix", () => {
		const rules = makeCodecRulesFromSettings({
			...defaultSettingsForUnitTests,
			splitPathToLibraryRoot: {
				basename: "Library",
				kind: "Folder",
				pathParts: ["Archive"],
			},
		});
		const result: SegmentationResult = {
			pages: [{ charCount: 10, content: "Page", pageIndex: 0 }],
			sourceCoreName: "Story",
			sourceSuffix: [],
			tooShortToSplit: false,
		};

		const plan = buildPageSplitActions(
			result,
			{
				basename: "Story",
				extension: "md",
				kind: "MdFile",
				pathParts: ["Archive", "Library"],
			},
			rules,
		);

		expect(Result.isSuccess(plan)).toBe(true);
		if (Result.isFailure(plan)) throw new Error("Expected nested Library split plan");
		const deleteAction = plan.success.treeActions[0];
		const createAction = plan.success.treeActions[1];
		expect(deleteAction?.targetLocator.segmentIdChainToParent).toHaveLength(1);
		if (createAction?.actionType !== "Create") {
			throw new Error("Expected page Create action");
		}
		expect(createAction.observedSplitPath.pathParts).toEqual([
			"Library",
			"Story",
		]);
		expect(
			plan.success.vaultActions[0]?.payload,
		).toMatchObject({
			splitPath: {
				pathParts: ["Archive", "Library", "Story"],
			},
		});
	});
});
