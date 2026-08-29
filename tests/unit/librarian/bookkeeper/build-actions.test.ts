import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import {
	makeCodecRulesFromSettings,
} from "@textfresser/library-core";
import { z } from "zod";
import {
	buildPageSplitActions,
} from "../../../../src/commanders/librarian/pages/build-actions";
import type { SegmentationResult } from "../../../../src/commanders/librarian/pages/types";
import { noteMetadataHelper } from "../../../../src/stateless-helpers/note-metadata";
import { defaultSettingsForUnitTests } from "../../common-utils/consts";
import { setupGetParsedUserSettingsSpy } from "../../common-utils/setup-spy";

let getParsedUserSettingsSpy: ReturnType<typeof spyOn>;

const PageMetadataSchema = z
	.object({
		nextPageIdx: z.number().optional(),
		noteKind: z.string().optional(),
		prevPageIdx: z.number().optional(),
		status: z.enum(["Done", "NotStarted"]).optional(),
	})
	.passthrough();

beforeEach(() => {
	getParsedUserSettingsSpy = setupGetParsedUserSettingsSpy();
});

afterEach(() => {
	getParsedUserSettingsSpy.mockRestore();
});

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
		expect(splitResult.isOk()).toBe(true);
		if (splitResult.isErr()) throw new Error("Expected valid split plan");
		const split = splitResult.value;

		const firstAction = split.vaultActions[0];
		if (!firstAction || firstAction.kind !== "UpsertMdFile") {
			throw new Error("Expected first action to upsert first page");
		}
		if (typeof firstAction.payload.content !== "string") {
			throw new Error("Expected split page content to be materialized");
		}

		const metadata = noteMetadataHelper.read(
			firstAction.payload.content,
			PageMetadataSchema,
		);
		expect(metadata?.noteKind).toBe("Page");
		expect(metadata?.status).toBe("NotStarted");
		expect(metadata?.prevPageIdx).toBeUndefined();
		expect(metadata?.nextPageIdx).toBeUndefined();
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

		expect(plan.isOk()).toBe(true);
		if (plan.isErr()) throw new Error("Expected nested Library split plan");
		const deleteAction = plan.value.treeActions[0];
		const createAction = plan.value.treeActions[1];
		expect(deleteAction?.targetLocator.segmentIdChainToParent).toHaveLength(1);
		if (createAction?.actionType !== "Create") {
			throw new Error("Expected page Create action");
		}
		expect(createAction.observedSplitPath.pathParts).toEqual([
			"Library",
			"Story",
		]);
		expect(
			plan.value.vaultActions[0]?.payload,
		).toMatchObject({
			splitPath: {
				pathParts: ["Archive", "Library", "Story"],
			},
		});
	});
});
