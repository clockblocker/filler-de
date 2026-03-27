/**
 * Unit test to verify scroll transforms preserve JSON metadata.
 */
import { describe, expect, it, mock } from "bun:test";
import { makeCodecRulesFromSettings, makeCodecs } from "../../src/commanders/librarian/codecs";
import type { SectionNodeSegmentId } from "../../src/commanders/librarian/codecs/segment-id";
import { NodeSegmentIdSeparator } from "../../src/commanders/librarian/codecs/segment-id/types/segment-id";
import {
	makeBacklinkTransform,
	makeStripScrollBacklinkTransform,
} from "../../src/commanders/librarian/healer/library-tree/codex/transforms/scroll-transforms";
import { noteMetadataHelper } from "../../src/stateless-helpers/note-metadata";
import { defaultSettingsForUnitTests } from "./common-utils/consts";

// Mock the global state module - MUST be before imports that use it
const mockSettings = defaultSettingsForUnitTests;
mock.module("../../src/global-state/global-state", () => ({
	getParsedUserSettings: () => mockSettings,
}));

const codecs = makeCodecs(
	makeCodecRulesFromSettings(defaultSettingsForUnitTests),
);

function makeSectionSegmentId(name: string): SectionNodeSegmentId {
	const separator = NodeSegmentIdSeparator;
	return `${name}${separator}Section${separator}` as SectionNodeSegmentId;
}

describe("scroll transforms preserve JSON metadata", () => {
	const JSON_META_SECTION = `<section id="textfresser_meta_keep_me_invisible">
{"noteKind":"Page","status":"NotStarted","prevPageIdx":0,"nextPageIdx":2}
</section>`;

	const contentWithMeta = `[[__-Aschenputtel-Märchen|← Aschenputtel]]

Page content here.

This is the middle page.




${JSON_META_SECTION}
`;

	it("makeBacklinkTransform preserves JSON metadata at end of file", () => {
		const parentChain = [
			makeSectionSegmentId("Library"),
			makeSectionSegmentId("Märchen"),
		];

		const transform = makeBacklinkTransform(parentChain, codecs);
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

	it("toggleStatus then makeBacklinkTransform preserves all metadata", async () => {
		// Simulate the real flow: first toggleStatus, then ProcessScrollBacklink
		// Step 1: toggleStatus to Done (this should merge with existing metadata)
		const toggleTransform = noteMetadataHelper.toggleStatus(true);
		const afterToggle = await toggleTransform(contentWithMeta);

		// Should have merged metadata
		expect(afterToggle).toContain('"status":"Done"');
		expect(afterToggle).toContain('"noteKind":"Page"');
		expect(afterToggle).toContain('"prevPageIdx":0');

		// Step 2: Apply scroll backlink transform
		const parentChain = [
			makeSectionSegmentId("Library"),
			makeSectionSegmentId("Märchen"),
		];
		const backlinkTransform = makeBacklinkTransform(parentChain, codecs);
		const afterBacklink = backlinkTransform(afterToggle);

		// Should still have all metadata
		expect(afterBacklink).toContain('"status":"Done"');
		expect(afterBacklink).toContain('"noteKind":"Page"');
		expect(afterBacklink).toContain('"prevPageIdx":0');
		expect(afterBacklink).toContain('"nextPageIdx":2');
	});
});
