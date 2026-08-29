// biome-ignore-all assist/source/organizeImports: Individual negative type-export assertions require adjacent suppression comments.
import { describe, expect, it } from "bun:test";
import type { TFile } from "obsidian";
import * as publicApi from "../../src";
import { splitPathCodec } from "../../src";

// @ts-expect-error -- live Obsidian references are intentionally internal.
import type { SplitPathToFileWithTRef } from "../../src";
// @ts-expect-error -- live Obsidian references are intentionally internal.
import type { SplitPathToFolderWithTRef } from "../../src";
// @ts-expect-error -- live Obsidian references are intentionally internal.
import type { SplitPathToMdFileWithTRef } from "../../src";
// @ts-expect-error -- live Obsidian references are intentionally internal.
import type { SplitPathWithTRef } from "../../src";

type PublicCodecInput = Parameters<typeof splitPathCodec.parse>[0];
type PublicCodecAcceptsTFile = TFile extends PublicCodecInput ? true : false;
const publicCodecAcceptsTFile: PublicCodecAcceptsTFile = false;

describe("Split Path package interface", () => {
	it("exports one immutable parse/format interface", () => {
		expect(Object.keys(splitPathCodec).sort()).toEqual([
			"format",
			"parse",
			"root",
		]);
		expect(Object.isFrozen(splitPathCodec)).toBe(true);
		expect(Object.isFrozen(splitPathCodec.root)).toBe(true);
	});

	it("does not export the old parallel interfaces", () => {
		expect("pathfinder" in publicApi).toBe(false);
		expect("makeSplitPath" in publicApi).toBe(false);
		expect("makeSystemPathForSplitPath" in publicApi).toBe(false);
	});

	it("accepts domain path strings rather than live Obsidian files", () => {
		expect(publicCodecAcceptsTFile).toBe(false);
		expect(splitPathCodec.parse("Library/Note.md")).toEqual({
			basename: "Note",
			extension: "md",
			kind: "MdFile",
			pathParts: ["Library"],
		});
	});
});

void (0 as unknown as SplitPathToFileWithTRef);
void (0 as unknown as SplitPathToFolderWithTRef);
void (0 as unknown as SplitPathToMdFileWithTRef);
void (0 as unknown as SplitPathWithTRef);
