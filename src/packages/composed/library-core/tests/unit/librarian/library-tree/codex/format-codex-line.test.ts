import { describe, expect, it } from "bun:test";
import {
	makeCodecRulesFromSettings,
	makeCodecs,
} from "../../../../../src/codecs";
import {
	formatChildSectionLine,
	formatFileLine,
	formatScrollLine,
} from "../../../../../src/healer/library-tree/codex/format-codex-line";
import { TreeNodeStatus } from "../../../../../src/healer/library-tree/tree-node/types/atoms";
import { defaultSettingsForUnitTests } from "../../../common-utils/consts";

const codecs = makeCodecs(
	makeCodecRulesFromSettings(defaultSettingsForUnitTests),
);

describe("format-codex-line", () => {
	describe("formatScrollLine", () => {
		it("formats NotStarted scroll at root", () => {
			// pathParts = ["Library"], nodeName = "Note"
			// basename = "Note" (no suffix at root)
			const result = formatScrollLine(
				"Note",
				["Library"],
				TreeNodeStatus.NotStarted,
				codecs,
			);
			expect(result).toBe("- [ ] [[Note|Note]]");
		});

		it("formats Done scroll at root", () => {
			const result = formatScrollLine(
				"Note",
				["Library"],
				TreeNodeStatus.Done,
				codecs,
			);
			expect(result).toBe("- [x] [[Note|Note]]");
		});

		it("formats scroll in section", () => {
			// pathParts = ["Library", "A"], nodeName = "Note"
			// basename = "Note-A"
			const result = formatScrollLine(
				"Note",
				["Library", "A"],
				TreeNodeStatus.NotStarted,
				codecs,
			);
			expect(result).toBe("- [ ] [[Note-A|Note]]");
		});

		it("formats scroll in nested section", () => {
			// pathParts = ["Library", "A", "B"], nodeName = "Note"
			// basename = "Note-B-A"
			const result = formatScrollLine(
				"Note",
				["Library", "A", "B"],
				TreeNodeStatus.NotStarted,
				codecs,
			);
			expect(result).toBe("- [ ] [[Note-B-A|Note]]");
		});
	});

	describe("formatFileLine", () => {
		it("formats file at root", () => {
			const result = formatFileLine("image", ["Library"], codecs);
			expect(result).toBe("- [[image|image]]");
		});

		it("formats file in section", () => {
			const result = formatFileLine("image", ["Library", "A"], codecs);
			expect(result).toBe("- [[image-A|image]]");
		});

		it("formats file in nested section", () => {
			const result = formatFileLine(
				"image",
				["Library", "A", "B"],
				codecs,
			);
			expect(result).toBe("- [[image-B-A|image]]");
		});
	});

	describe("formatChildSectionLine", () => {
		it("formats NotStarted child section", () => {
			// Section "A" at ["Library"]
			// codex basename = "__-A"
			const result = formatChildSectionLine(
				"A",
				["Library"],
				TreeNodeStatus.NotStarted,
				codecs,
			);
			expect(result).toBe("- [ ] [[__-A|A]]");
		});

		it("formats Done child section", () => {
			const result = formatChildSectionLine(
				"A",
				["Library"],
				TreeNodeStatus.Done,
				codecs,
			);
			expect(result).toBe("- [x] [[__-A|A]]");
		});

		it("formats nested child section", () => {
			// Section "B" at ["Library", "A"]
			// codex basename = "__-B-A"
			const result = formatChildSectionLine(
				"B",
				["Library", "A"],
				TreeNodeStatus.NotStarted,
				codecs,
			);
			expect(result).toBe("- [ ] [[__-B-A|B]]");
		});
	});
});
