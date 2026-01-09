import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import {
	formatChildSectionLine,
	formatFileLine,
	formatParentBacklink,
	formatScrollLine,
} from "../../../../../src/commanders/librarian-new/library-tree/codex/format-codex-line";
import { TreeNodeStatus } from "../../../../../src/commanders/librarian-new/library-tree/tree-node/types/atoms";
import { setupGetParsedUserSettingsSpy } from "../../../common-utils/setup-spy";

let getParsedUserSettingsSpy: ReturnType<typeof spyOn>;

beforeEach(() => {
	getParsedUserSettingsSpy = setupGetParsedUserSettingsSpy();
});

afterEach(() => {
	getParsedUserSettingsSpy.mockRestore();
});

describe("format-codex-line", () => {
	describe("formatScrollLine", () => {
		it("formats NotStarted scroll at root", () => {
			// pathParts = ["Library"], nodeName = "Note"
			// basename = "Note" (no suffix at root)
			const result = formatScrollLine(
				"Note",
				["Library"],
				TreeNodeStatus.NotStarted,
			);
			expect(result).toBe("- [ ] [[Note|Note]]");
		});

		it("formats Done scroll at root", () => {
			const result = formatScrollLine(
				"Note",
				["Library"],
				TreeNodeStatus.Done,
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
			);
			expect(result).toBe("- [ ] [[Note-B-A|Note]]");
		});
	});

	describe("formatFileLine", () => {
		it("formats file at root", () => {
			const result = formatFileLine("image", ["Library"]);
			expect(result).toBe("- [[image|image]]");
		});

		it("formats file in section", () => {
			const result = formatFileLine("image", ["Library", "A"]);
			expect(result).toBe("- [[image-A|image]]");
		});

		it("formats file in nested section", () => {
			const result = formatFileLine("image", ["Library", "A", "B"]);
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
			);
			expect(result).toBe("- [ ] [[__-A|A]]");
		});

		it("formats Done child section", () => {
			const result = formatChildSectionLine(
				"A",
				["Library"],
				TreeNodeStatus.Done,
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
			);
			expect(result).toBe("- [ ] [[__-B-A|B]]");
		});
	});

	describe("formatParentBacklink", () => {
		it("formats backlink to library root", () => {
			// Parent is Library root
			// codex basename = "__-Library"
			const result = formatParentBacklink("Library", ["Library"]);
			expect(result).toBe("[[__-Library|← Library]]");
		});

		it("formats backlink to first-level section", () => {
			// Parent is section "A" at ["Library"]
			// codex basename = "__-A"
			const result = formatParentBacklink("A", ["Library", "A"]);
			expect(result).toBe("[[__-A|← A]]");
		});

		it("formats backlink to nested section", () => {
			// Parent is section "B" at ["Library", "A"]
			// codex basename = "__-B-A"
			const result = formatParentBacklink("B", ["Library", "A", "B"]);
			expect(result).toBe("[[__-B-A|← B]]");
		});
	});
});
