import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import { TreeNodeStatus } from "../../../../src/commanders/librarian/healer/library-tree/tree-node/types/atoms";
import type { NodeName } from "../../../../src/commanders/librarian/types/schemas/node-name";
import { setupGetParsedUserSettingsSpy } from "../../common-utils/setup-spy";
import {
	makeScrollLocator,
	makeTree,
} from "./tree-test-helpers";

let getParsedUserSettingsSpy: ReturnType<typeof spyOn>;

beforeEach(() => {
	getParsedUserSettingsSpy = setupGetParsedUserSettingsSpy();
});

afterEach(() => {
	getParsedUserSettingsSpy.mockRestore();
});

describe("Tree corename index", () => {
	it("returns empty for no matches", () => {
		const healer = makeTree({
			children: {
				german: {
					children: {
						laufen: { kind: "Scroll" },
					},
				},
			},
			libraryRoot: "Library" as NodeName,
		});

		expect(healer.getLeavesByCoreName("nonexistent")).toEqual([]);
	});

	it("finds a single leaf by corename", () => {
		const healer = makeTree({
			children: {
				german: {
					children: {
						pick: { kind: "Scroll" },
					},
				},
			},
			libraryRoot: "Library" as NodeName,
		});

		const matches = healer.getLeavesByCoreName("pick");
		expect(matches).toHaveLength(1);
		expect(matches[0]!.basename).toBe("pick-german");
		expect(matches[0]!.pathParts).toEqual(["Library", "german"]);
	});

	it("finds multiple leaves with same corename in different sections", () => {
		const healer = makeTree({
			children: {
				english: {
					children: {
						pick: { kind: "Scroll" },
					},
				},
				german: {
					children: {
						pick: { kind: "Scroll" },
					},
				},
			},
			libraryRoot: "Library" as NodeName,
		});

		const matches = healer.getLeavesByCoreName("pick");
		expect(matches).toHaveLength(2);

		const basenames = matches.map((m) => m.basename).sort();
		expect(basenames).toEqual(["pick-english", "pick-german"]);
	});

	it("finds leaf in nested sections", () => {
		const healer = makeTree({
			children: {
				german: {
					children: {
						word: {
							children: {
								laufen: { kind: "Scroll" },
							},
						},
					},
				},
			},
			libraryRoot: "Library" as NodeName,
		});

		const matches = healer.getLeavesByCoreName("laufen");
		expect(matches).toHaveLength(1);
		expect(matches[0]!.basename).toBe("laufen-word-german");
		expect(matches[0]!.pathParts).toEqual(["Library", "german", "word"]);
	});

	it("skips codex nodes (__ prefix)", () => {
		const healer = makeTree({
			children: {
				german: {
					children: {
						__: { kind: "Scroll" },
						pick: { kind: "Scroll" },
					},
				},
			},
			libraryRoot: "Library" as NodeName,
		});

		const codexMatches = healer.getLeavesByCoreName("__");
		expect(codexMatches).toEqual([]);

		const pickMatches = healer.getLeavesByCoreName("pick");
		expect(pickMatches).toHaveLength(1);
	});

	it("includes File nodes (non-md)", () => {
		const healer = makeTree({
			children: {
				german: {
					children: {
						image: { extension: "png", kind: "File" },
					},
				},
			},
			libraryRoot: "Library" as NodeName,
		});

		const matches = healer.getLeavesByCoreName("image");
		expect(matches).toHaveLength(1);
		expect(matches[0]!.basename).toBe("image-german");
	});

	it("invalidates index after tree mutation", () => {
		const healer = makeTree({
			children: {
				german: {
					children: {
						pick: { kind: "Scroll" },
					},
				},
			},
			libraryRoot: "Library" as NodeName,
		});

		// First lookup builds index
		expect(healer.getLeavesByCoreName("pick")).toHaveLength(1);

		// Mutate tree via healer (add a new node)
		healer.getHealingActionsFor({
			actionType: "Create",
			initialStatus: TreeNodeStatus.NotStarted,
			observedSplitPath: {
				basename: "run-german",
				extension: "md",
				kind: "MdFile" as const,
				pathParts: ["Library", "german"],
			},
			targetLocator: makeScrollLocator(
				["Library" as NodeName, "german" as NodeName],
				"run" as NodeName,
			),
		});

		// After mutation, new leaf should be found
		const runMatches = healer.getLeavesByCoreName("run");
		expect(runMatches).toHaveLength(1);
		expect(runMatches[0]!.basename).toBe("run-german");
	});

	it("finds leaf at library root level", () => {
		const healer = makeTree({
			children: {
				note: { kind: "Scroll" },
			},
			libraryRoot: "Library" as NodeName,
		});

		const matches = healer.getLeavesByCoreName("note");
		expect(matches).toHaveLength(1);
		// At root level, no suffix parts → basename is just the corename
		expect(matches[0]!.basename).toBe("note");
		expect(matches[0]!.pathParts).toEqual(["Library"]);
	});
});
