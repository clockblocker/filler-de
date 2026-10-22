/**
 * Toggling "Hide metadata" moves each note's metadata into the selected
 * format, in both directions.
 */
import { describe, expect, it } from "bun:test";
import {
	SplitPathKind,
	type SplitPathToFolder,
	type SplitPathToMdFile,
	type VaultAction,
	VaultActionKind,
	type VaultScanPath,
} from "@textfresser/vault-action-manager";
import { Effect } from "effect";
import { z } from "zod";
import {
	describeMetadataMigration,
	migrateMetadataFormat,
} from "../../../src/commanders/note-metadata-migration/migrate-metadata-format";
import {
	defineNestedNamespace,
	LibraryMetadata,
	noteMetadataHelper as meta,
} from "../../../src/stateless-helpers/note-metadata";
import { actionError, failedActions } from "../../support/vam-dispatch";
import { setupGetParsedUserSettingsSpyWithHooks } from "../common-utils/setup-spy";

setupGetParsedUserSettingsSpyWithHooks({ hideMetadata: true });

const OPEN = '<section id="textfresser_meta_keep_me_invisible">';
const PADDING = "\n".repeat(20);

const Dictionary = defineNestedNamespace({
	key: "dictionary",
	name: "dictionary",
	schema: z.object({
		lemma: z.string(),
		readings: z.array(z.object({ emoji: z.string(), links: z.array(z.string()) })),
	}),
	version: 1,
});
const DATA = {
	lemma: "Fahrer %% </section>",
	readings: [{ emoji: "🚗", links: ["[[Worter/f/fah/fahre/Fahrer|Fahrer]]"] }],
};
const NAMESPACES = [LibraryMetadata, Dictionary];

const hiddenNote = `Text\n${PADDING}${OPEN}\n{"status":"Done","noteKind":"Page","prevPageIdx":0}\n</section>\n`;

describe("format conversion", () => {
	it("moves hidden metadata into frontmatter, keeping the user's properties", () => {
		const withFrontmatter = `---\ntags:\n  - a\n---\n${hiddenNote}`;
		const converted = meta.convertNote(withFrontmatter, "Frontmatter", NAMESPACES);
		expect(converted.moved).toEqual(["library"]);
		expect(converted.content).toBe(
			"---\ntags:\n  - a\nnoteKind: Page\nstatus: true\nprevPageIdx: 0\n---\nText\n",
		);
	});

	it("never lets unclaimed hidden keys replace a user property", () => {
		const content = `---\ntags: mine\n---\nText\n${OPEN}\n{"status":"Done","tags":"plugin","extra":1}\n</section>\n`;
		expect(meta.convertFormat("Frontmatter", NAMESPACES)(content)).toBe(
			`---\ntags: mine\nstatus: true\nextra: 1\n---\nText${PADDING}${OPEN}\n{"tags":"plugin"}\n</section>\n`,
		);
	});

	it("moves frontmatter metadata into the hidden section, keeping the user's properties", () => {
		const content = "---\ntags:\n  - a\nstatus: true\nnoteKind: Page\n---\nText\n";
		expect(meta.convertFormat("Hidden", NAMESPACES)(content)).toBe(
			`---\ntags:\n  - a\n---\nText${PADDING}${OPEN}\n{"noteKind":"Page","status":"Done"}\n</section>\n`,
		);
	});

	it("drops a frontmatter block that only held moved metadata", () => {
		expect(meta.convertFormat("Hidden", NAMESPACES)("---\nstatus: false\n---\nText\n")).toBe(
			`Text${PADDING}${OPEN}\n{"status":"NotStarted"}\n</section>\n`,
		);
	});

	it("round-trips nested data in both directions", () => {
		const hidden = meta.write(Dictionary, DATA, "Hidden")(
			meta.write(LibraryMetadata, { status: "Done" }, "Hidden")("Text\n"),
		);
		const frontmatter = meta.convertFormat("Frontmatter", NAMESPACES)(hidden);
		expect(frontmatter).not.toContain(OPEN);
		expect(meta.read(frontmatter, Dictionary, "Frontmatter")).toEqual(DATA);
		expect(meta.read(frontmatter, LibraryMetadata, "Frontmatter")).toEqual({
			status: "Done",
		});

		const back = meta.convertFormat("Hidden", NAMESPACES)(frontmatter);
		expect(back).toBe(hidden);
	});

	it("moves data of a newer version as it is", () => {
		const newer = `Text\n${OPEN}\n${JSON.stringify({ dictionary: { future: true, schemaVersion: 9 } })}\n</section>\n`;
		const converted = meta.convertFormat("Frontmatter", NAMESPACES)(newer);
		expect(converted).toBe("---\ndictionary:\n  future: true\n  schemaVersion: 9\n---\nText\n");
		expect(meta.convertFormat("Hidden", NAMESPACES)(converted)).toBe(
			`Text${PADDING}${OPEN}\n{"dictionary":{"future":true,"schemaVersion":9}}\n</section>\n`,
		);
	});

	it("leaves a note alone when its frontmatter cannot be parsed", () => {
		const content = `---\n: : [unclosed\n---\n${hiddenNote}`;
		const converted = meta.convertNote(content, "Frontmatter", NAMESPACES);
		expect(converted.content).toBe(content);
		expect(converted.issues.map(({ issue }) => issue.kind)).toEqual([
			"UnreadableFrontmatter",
			"UnreadableFrontmatter",
		]);
	});

	it("is a no-op on notes already in the target format", () => {
		for (const content of [hiddenNote, "Plain text\n", "---\nstatus: true\n---\nText\n"]) {
			const target = content.includes(OPEN) ? "Hidden" : "Frontmatter";
			expect(meta.convertFormat(target, NAMESPACES)(content)).toBe(content);
		}
	});
});

describe("migrateMetadataFormat", () => {
	const library: SplitPathToFolder = {
		basename: "Library",
		kind: SplitPathKind.Folder,
		pathParts: [],
	};
	const md = (basename: string): SplitPathToMdFile => ({
		basename,
		extension: "md",
		kind: SplitPathKind.MdFile,
		pathParts: ["Library"],
	});

	function vault(files: Record<string, string>, failing: string[] = []) {
		const contents = new Map(Object.entries(files));
		return {
			contents,
			vam: {
				dispatch: (actions: readonly VaultAction[]) =>
					Effect.gen(function* () {
						for (const action of actions) {
							if (action.kind !== VaultActionKind.ProcessMdFile) continue;
							if (!("transform" in action.payload)) continue;
							const { splitPath, transform } = action.payload;
							const name = splitPath.basename;
							if (failing.includes(name)) {
								return yield* Effect.fail(
									failedActions([
										actionError(
											action,
											new Error(`cannot write ${name}`),
										),
									]),
								);
							}
							const next = yield* Effect.promise(async () =>
								transform(contents.get(name) ?? ""),
							);
							contents.set(name, next);
						}
					}),
				scan: () =>
					Effect.succeed({
						counts: {
							folderCount: 1,
							markdownFileCount: contents.size,
							otherFileCount: 0,
						},
						diagnostics: [],
						entries: [...contents.keys()].map(
							(name): VaultScanPath => ({
								...md(name),
								read: () => Effect.succeed(contents.get(name) ?? ""),
							}),
						),
						kind: "Complete" as const,
					}),
			},
		};
	}

	it("rewrites every note that carries metadata and reports the rest", async () => {
		const { contents, vam } = vault(
			{
				Broken: `---\n: : [unclosed\n---\n${hiddenNote}`,
				Done: hiddenNote,
				Locked: hiddenNote,
				Plain: "No metadata here\n",
			},
			["Locked"],
		);
		const report = await Effect.runPromise(
			migrateMetadataFormat(vam as never, "Frontmatter", [
				{ folder: library, namespaces: [LibraryMetadata] },
			]),
		);
		expect(report.scanned).toBe(4);
		expect(report.converted).toEqual(["Library/Done.md"]);
		expect(report.skipped).toEqual([
			{ namespace: "library", path: "Library/Broken.md", reason: "UnreadableFrontmatter" },
		]);
		expect(report.failed.map(({ path }) => path)).toEqual(["Library/Locked.md"]);
		expect(contents.get("Done")).toBe(
			"---\nnoteKind: Page\nstatus: true\nprevPageIdx: 0\n---\nText\n",
		);
		expect(contents.get("Plain")).toBe("No metadata here\n");
		expect(describeMetadataMigration(report)).toBe(
			"Moved metadata of 1 of 4 note(s) into frontmatter. 1 left unchanged (unreadable data). 1 failed; see the console.",
		);

		const back = await Effect.runPromise(
			migrateMetadataFormat(vam as never, "Hidden", [
				{ folder: library, namespaces: [LibraryMetadata] },
			]),
		);
		expect(back.converted).toEqual(["Library/Done.md"]);
		// Unclaimed frontmatter keys belong to the user, so the legacy page
		// index that came along stays there.
		expect(contents.get("Done")).toBe(
			`---\nprevPageIdx: 0\n---\nText${PADDING}${OPEN}\n{"noteKind":"Page","status":"Done"}\n</section>\n`,
		);
	});
});
