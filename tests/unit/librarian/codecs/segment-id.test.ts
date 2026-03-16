import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { makeSegmentIdCodecs } from "../../../../src/commanders/librarian/codecs/segment-id/make";
import type { SegmentIdCodecs } from "../../../../src/commanders/librarian/codecs/segment-id/make";
import { TreeNodeKind } from "../../../../src/commanders/librarian/healer/library-tree/tree-node/types/atoms";
import type { TreeNodeSegmentId } from "../../../../src/commanders/librarian/codecs/segment-id/types/segment-id";
import type {
	ScrollNodeSegmentId,
	SectionNodeSegmentId,
	FileNodeSegmentId,
} from "../../../../src/commanders/librarian/codecs/segment-id/types/segment-id";
import type { CodecRules } from "../../../../src/commanders/librarian/codecs/rules";
import { setupGetParsedUserSettingsSpy } from "../../common-utils/setup-spy";
import { defaultSettingsForUnitTests } from "../../common-utils/consts";

// ﹘ = SMALL_EM_DASH (U+FE58) - the NodeSegmentIdSeparator
const SEP = "﹘";

function makeDefaultRules(): CodecRules {
	return {
		hideMetadata: defaultSettingsForUnitTests.hideMetadata,
		languages: defaultSettingsForUnitTests.languages,
		libraryRootName: "Library",
		libraryRootPathParts: [],
		showScrollBacklinks: defaultSettingsForUnitTests.showScrollBacklinks,
		suffixDelimiter: defaultSettingsForUnitTests.suffixDelimiter,
		suffixDelimiterConfig: defaultSettingsForUnitTests.suffixDelimiterConfig,
		suffixDelimiterPattern:
			defaultSettingsForUnitTests.suffixDelimiterPattern,
	};
}

describe("segment-id codecs", () => {
	let spy: ReturnType<typeof setupGetParsedUserSettingsSpy>;
	let codecs: SegmentIdCodecs;

	beforeEach(() => {
		spy = setupGetParsedUserSettingsSpy();
		codecs = makeSegmentIdCodecs(makeDefaultRules());
	});

	afterEach(() => {
		spy.mockRestore();
	});

	describe("parseSegmentId", () => {
		it("parses Section segment ID", () => {
			const id = `MySection${SEP}Section${SEP}` as TreeNodeSegmentId;
			const result = codecs.parseSegmentId(id);
			expect(result.isOk()).toBe(true);
			expect(result._unsafeUnwrap()).toEqual({
				coreName: "MySection",
				targetKind: TreeNodeKind.Section,
			});
		});

		it("parses Scroll segment ID", () => {
			const id = `MyScroll${SEP}Scroll${SEP}md` as TreeNodeSegmentId;
			const result = codecs.parseSegmentId(id);
			expect(result.isOk()).toBe(true);
			expect(result._unsafeUnwrap()).toEqual({
				coreName: "MyScroll",
				extension: "md",
				targetKind: TreeNodeKind.Scroll,
			});
		});

		it("parses File segment ID", () => {
			const id = `MyFile${SEP}File${SEP}png` as TreeNodeSegmentId;
			const result = codecs.parseSegmentId(id);
			expect(result.isOk()).toBe(true);
			expect(result._unsafeUnwrap()).toEqual({
				coreName: "MyFile",
				extension: "png",
				targetKind: TreeNodeKind.File,
			});
		});

		it("returns error for missing parts (only one part)", () => {
			const id = "JustAName" as TreeNodeSegmentId;
			const result = codecs.parseSegmentId(id);
			expect(result.isErr()).toBe(true);
			if (result.isErr()) {
				expect(result.error.kind).toBe("SegmentIdError");
				expect((result.error as { reason: string }).reason).toBe(
					"MissingParts",
				);
			}
		});

		it("returns error for unknown TreeNodeKind", () => {
			const id =
				`MyNode${SEP}UnknownKind${SEP}md` as TreeNodeSegmentId;
			const result = codecs.parseSegmentId(id);
			expect(result.isErr()).toBe(true);
			if (result.isErr()) {
				expect((result.error as { reason: string }).reason).toBe(
					"UnknownType",
				);
			}
		});

		it("returns error for Section with non-empty extension", () => {
			const id =
				`MySection${SEP}Section${SEP}md` as TreeNodeSegmentId;
			const result = codecs.parseSegmentId(id);
			expect(result.isErr()).toBe(true);
			if (result.isErr()) {
				expect((result.error as { reason: string }).reason).toBe(
					"InvalidExtension",
				);
			}
		});

		it("returns error for Scroll without extension", () => {
			const id = `MyScroll${SEP}Scroll` as TreeNodeSegmentId;
			const result = codecs.parseSegmentId(id);
			// Only 2 parts: coreName + "Scroll", missing extension
			expect(result.isErr()).toBe(true);
		});

		it("returns error for Scroll with non-md extension", () => {
			const id =
				`MyScroll${SEP}Scroll${SEP}txt` as TreeNodeSegmentId;
			const result = codecs.parseSegmentId(id);
			expect(result.isErr()).toBe(true);
			if (result.isErr()) {
				expect((result.error as { reason: string }).reason).toBe(
					"InvalidExtension",
				);
			}
		});

		it("returns error for File without extension", () => {
			const id = `MyFile${SEP}File` as TreeNodeSegmentId;
			const result = codecs.parseSegmentId(id);
			expect(result.isErr()).toBe(true);
		});

		it("returns error for empty coreName", () => {
			const id = `${SEP}Section${SEP}` as TreeNodeSegmentId;
			const result = codecs.parseSegmentId(id);
			expect(result.isErr()).toBe(true);
			if (result.isErr()) {
				expect((result.error as { reason: string }).reason).toBe(
					"InvalidNodeName",
				);
			}
		});
	});

	describe("type-specific convenience parsers", () => {
		it("parseSectionSegmentId", () => {
			const id = `Library${SEP}Section${SEP}` as SectionNodeSegmentId;
			const result = codecs.parseSectionSegmentId(id);
			expect(result.isOk()).toBe(true);
			expect(result._unsafeUnwrap().targetKind).toBe(
				TreeNodeKind.Section,
			);
		});

		it("parseScrollSegmentId", () => {
			const id = `MyNote${SEP}Scroll${SEP}md` as ScrollNodeSegmentId;
			const result = codecs.parseScrollSegmentId(id);
			expect(result.isOk()).toBe(true);
			expect(result._unsafeUnwrap().targetKind).toBe(
				TreeNodeKind.Scroll,
			);
			expect(result._unsafeUnwrap().extension).toBe("md");
		});

		it("parseFileSegmentId", () => {
			const id = `Image${SEP}File${SEP}png` as FileNodeSegmentId;
			const result = codecs.parseFileSegmentId(id);
			expect(result.isOk()).toBe(true);
			expect(result._unsafeUnwrap().targetKind).toBe(TreeNodeKind.File);
			expect(result._unsafeUnwrap().extension).toBe("png");
		});
	});

	describe("serializeSegmentId", () => {
		it("serializes Section segment ID", () => {
			const result = codecs.serializeSegmentId({
				coreName: "MySection" as any,
				targetKind: TreeNodeKind.Section,
			});
			expect(result).toBe(`MySection${SEP}Section${SEP}`);
		});

		it("serializes Scroll segment ID", () => {
			const result = codecs.serializeSegmentId({
				coreName: "MyScroll" as any,
				extension: "md" as any,
				targetKind: TreeNodeKind.Scroll,
			});
			expect(result).toBe(`MyScroll${SEP}Scroll${SEP}md`);
		});

		it("serializes File segment ID", () => {
			const result = codecs.serializeSegmentId({
				coreName: "MyFile" as any,
				extension: "png" as any,
				targetKind: TreeNodeKind.File,
			});
			expect(result).toBe(`MyFile${SEP}File${SEP}png`);
		});
	});

	describe("serializeSegmentIdUnchecked", () => {
		it("validates and serializes Section", () => {
			const result = codecs.serializeSegmentIdUnchecked({
				coreName: "MySection",
				targetKind: TreeNodeKind.Section,
			});
			expect(result.isOk()).toBe(true);
			expect(result._unsafeUnwrap()).toBe(
				`MySection${SEP}Section${SEP}`,
			);
		});

		it("validates and serializes Scroll", () => {
			const result = codecs.serializeSegmentIdUnchecked({
				coreName: "MyScroll",
				extension: "md",
				targetKind: TreeNodeKind.Scroll,
			});
			expect(result.isOk()).toBe(true);
			expect(result._unsafeUnwrap()).toBe(
				`MyScroll${SEP}Scroll${SEP}md`,
			);
		});

		it("returns error for Section with extension", () => {
			const result = codecs.serializeSegmentIdUnchecked({
				coreName: "MySection",
				extension: "md",
				targetKind: TreeNodeKind.Section,
			});
			expect(result.isErr()).toBe(true);
		});

		it("returns error for Scroll without extension", () => {
			const result = codecs.serializeSegmentIdUnchecked({
				coreName: "MyScroll",
				targetKind: TreeNodeKind.Scroll,
			});
			expect(result.isErr()).toBe(true);
		});

		it("returns error for empty coreName", () => {
			const result = codecs.serializeSegmentIdUnchecked({
				coreName: "",
				targetKind: TreeNodeKind.Section,
			});
			expect(result.isErr()).toBe(true);
		});
	});

	describe("parse/serialize roundtrip", () => {
		it("roundtrips Section segment ID", () => {
			const original = `MySection${SEP}Section${SEP}` as TreeNodeSegmentId;
			const parsed = codecs.parseSegmentId(original);
			expect(parsed.isOk()).toBe(true);
			const serialized = codecs.serializeSegmentId(
				parsed._unsafeUnwrap(),
			);
			expect(serialized).toBe(original);
		});

		it("roundtrips Scroll segment ID", () => {
			const original = `MyScroll${SEP}Scroll${SEP}md` as TreeNodeSegmentId;
			const parsed = codecs.parseSegmentId(original);
			expect(parsed.isOk()).toBe(true);
			const serialized = codecs.serializeSegmentId(
				parsed._unsafeUnwrap(),
			);
			expect(serialized).toBe(original);
		});

		it("roundtrips File segment ID", () => {
			const original = `Image${SEP}File${SEP}png` as TreeNodeSegmentId;
			const parsed = codecs.parseSegmentId(original);
			expect(parsed.isOk()).toBe(true);
			const serialized = codecs.serializeSegmentId(
				parsed._unsafeUnwrap(),
			);
			expect(serialized).toBe(original);
		});
	});
});
