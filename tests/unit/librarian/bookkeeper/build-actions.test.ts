import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import { z } from "zod";
import {
	buildPageSplitActions,
} from "../../../../src/commanders/librarian/pages/build-actions";
import type { SegmentationResult } from "../../../../src/commanders/librarian/pages/types";
import {
	makeCodecRulesFromSettings,
} from "@textfresser/library-core/codecs";
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

		const split = buildPageSplitActions(
			result,
			{
				basename: "Story-LibrarySection",
				extension: "md",
				kind: "MdFile",
				pathParts: ["Library"],
			},
			rules,
		);

		const firstAction = split.actions[0];
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
	});
});
