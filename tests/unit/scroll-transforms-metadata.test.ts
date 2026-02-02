/**
 * Unit test to verify scroll transforms preserve JSON metadata.
 */
import { describe, expect, it, mock } from "bun:test";
import { z } from "zod";

// Mock the global state module - MUST be before imports that use it
const mockSettings = { hideMetadata: true, suffixDelimiter: "-" };
mock.module("../../src/global-state/global-state", () => ({
	getParsedUserSettings: () => mockSettings,
}));

// Now import modules that depend on global-state
import { makeCodecs } from "../../src/commanders/librarian/codecs";
import {
	makeScrollBacklinkTransform,
	makeStripScrollBacklinkTransform,
} from "../../src/commanders/librarian/healer/library-tree/codex/transforms/scroll-transforms";
import type { SectionNodeSegmentId } from "../../src/commanders/librarian/codecs/segment-id";
import { noteMetadataHelper } from "../../src/stateless-helpers/note-metadata";

// Simple mock codecs with parseSegmentId that extracts section name
const mockCodecs = {
	...makeCodecs({
		suffixDelimiter: "-",
	}),
	parseSegmentId: (id: string) => ({
		isOk: () => true,
		isErr: () => false,
		value: {
			coreName: id.split("::")[0] ?? id,
			extension: undefined,
			targetKind: "Section" as const,
		},
	}),
} as any;

describe("scroll transforms preserve JSON metadata", () => {
	const JSON_META_SECTION = `<section id="textfresser_meta_keep_me_invisible">
{"noteKind":"Page","status":"NotStarted","prevPageIdx":0,"nextPageIdx":2}
</section>`;

	const contentWithMeta = `[[__-Aschenputtel-Märchen|← Aschenputtel]]

Page content here.

This is the middle page.




${JSON_META_SECTION}
`;

	it("makeScrollBacklinkTransform preserves JSON metadata at end of file", () => {
		const parentChain = ["Library::Section", "Märchen::Section"] as SectionNodeSegmentId[];

		const transform = makeScrollBacklinkTransform(parentChain, mockCodecs);
		const result = transform(contentWithMeta);

		// Should contain the JSON metadata section
		expect(result).toContain("textfresser_meta_keep_me_invisible");
		expect(result).toContain('"noteKind":"Page"');
		expect(result).toContain('"prevPageIdx":0');
		expect(result).toContain('"nextPageIdx":2');
	});

	it("makeStripScrollBacklinkTransform preserves JSON metadata at end of file", () => {
		const transform = makeStripScrollBacklinkTransform();
		const result = transform(contentWithMeta);

		// Should contain the JSON metadata section
		expect(result).toContain("textfresser_meta_keep_me_invisible");
		expect(result).toContain('"noteKind":"Page"');
		expect(result).toContain('"prevPageIdx":0');
		expect(result).toContain('"nextPageIdx":2');
	});

	it("toggleStatus then makeScrollBacklinkTransform preserves all metadata", () => {
		// Simulate the real flow: first toggleStatus, then ProcessScrollBacklink
		// Step 1: toggleStatus to Done (this should merge with existing metadata)
		const toggleTransform = noteMetadataHelper.toggleStatus(true);
		const afterToggle = toggleTransform(contentWithMeta);

		// Should have merged metadata
		expect(afterToggle).toContain('"status":"Done"');
		expect(afterToggle).toContain('"noteKind":"Page"');
		expect(afterToggle).toContain('"prevPageIdx":0');

		// Step 2: Apply scroll backlink transform
		const parentChain = ["Library::Section", "Märchen::Section"] as SectionNodeSegmentId[];
		const backlinkTransform = makeScrollBacklinkTransform(parentChain, mockCodecs);
		const afterBacklink = backlinkTransform(afterToggle);

		// Should still have all metadata
		expect(afterBacklink).toContain('"status":"Done"');
		expect(afterBacklink).toContain('"noteKind":"Page"');
		expect(afterBacklink).toContain('"prevPageIdx":0');
		expect(afterBacklink).toContain('"nextPageIdx":2');
	});
});
