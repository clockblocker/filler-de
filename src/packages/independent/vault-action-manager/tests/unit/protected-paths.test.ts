import { describe, expect, it } from "bun:test";
import { ProtectedPaths } from "../../src/impl/protected-paths";
import { splitPathCodec } from "../../src/split-path-codec";
import type {
	SplitPathToFile,
	SplitPathToFolder,
	SplitPathToMdFile,
} from "../../src/types/split-path";
import {
	type VaultAction,
	VaultActionKind,
} from "../../src/types/vault-action";

const md = (path: string) => splitPathCodec.parse(path) as SplitPathToMdFile;
const folder = (path: string) =>
	splitPathCodec.parse(path) as SplitPathToFolder;
const file = (path: string) => splitPathCodec.parse(path) as SplitPathToFile;

const exemplar = new ProtectedPaths(["Exemplar"]);

describe("ProtectedPaths prefix matching", () => {
	it("covers the prefix itself and everything below it", () => {
		expect(exemplar.prefixCovering("Exemplar")).toBe("Exemplar");
		expect(exemplar.prefixCovering("Exemplar/Kohlekraftwerk")).toBe(
			"Exemplar",
		);
		expect(
			exemplar.prefixCovering(
				"Exemplar/Kohlekraftwerk/Kohlekraftwerk.md",
			),
		).toBe("Exemplar");
	});

	it("matches whole segments only", () => {
		expect(exemplar.prefixCovering("Exemplars")).toBeUndefined();
		expect(exemplar.prefixCovering("Exemplars/Note.md")).toBeUndefined();
		expect(exemplar.prefixCovering("Exemplar.md")).toBeUndefined();
		expect(exemplar.prefixCovering("Exemplar-old/Note.md")).toBeUndefined();
		expect(
			exemplar.prefixCovering("Notes/Exemplar/Note.md"),
		).toBeUndefined();
		expect(exemplar.prefixCovering("Exempla")).toBeUndefined();
	});

	it("never covers the vault root", () => {
		expect(exemplar.prefixCovering("")).toBeUndefined();
		expect(exemplar.prefixCovering("/")).toBeUndefined();
	});

	it("ignores case, stray slashes, backslashes, and Unicode composition", () => {
		expect(exemplar.prefixCovering("exemplar/note.md")).toBe("Exemplar");
		expect(exemplar.prefixCovering("EXEMPLAR")).toBe("Exemplar");
		expect(exemplar.prefixCovering("/Exemplar/Note.md")).toBe("Exemplar");
		expect(exemplar.prefixCovering("Exemplar//Note.md")).toBe("Exemplar");
		expect(exemplar.prefixCovering("Exemplar\\Note.md")).toBe("Exemplar");

		const composed = new ProtectedPaths(["Bücher"]);
		expect(composed.prefixCovering("Bücher/Note.md")).toBe("Bücher");
	});

	it("normalizes configured prefixes and drops duplicates", () => {
		const paths = new ProtectedPaths([
			"/Exemplar/Kohlekraftwerk/",
			"Exemplar\\Kohlekraftwerk",
			"Other",
		]);
		expect(paths.prefixes).toEqual(["Exemplar/Kohlekraftwerk", "Other"]);
		expect(paths.prefixCovering("Exemplar/Kohlekraftwerk/K.md")).toBe(
			"Exemplar/Kohlekraftwerk",
		);
		expect(paths.prefixCovering("Exemplar/Other.md")).toBeUndefined();
	});

	it("refuses to protect the vault root", () => {
		expect(() => new ProtectedPaths([""])).toThrow(/vault root/);
		expect(() => new ProtectedPaths(["/"])).toThrow(/vault root/);
	});

	it("finds a prefix strictly inside a folder", () => {
		const nested = new ProtectedPaths(["Exemplar/Kohlekraftwerk"]);
		expect(nested.prefixInside("Exemplar")).toBe("Exemplar/Kohlekraftwerk");
		expect(nested.prefixInside("")).toBe("Exemplar/Kohlekraftwerk");
		expect(nested.prefixInside("Exemplars")).toBeUndefined();
		expect(nested.prefixInside("Exemplar/Kohlekraftwerk")).toBeUndefined();
	});
});

describe("ProtectedPaths.findViolation", () => {
	const nested = new ProtectedPaths(["Exemplar/Kohlekraftwerk"]);
	const inside = "Exemplar/Kohlekraftwerk/Kohlekraftwerk.md";

	const insideActions: readonly VaultAction[] = [
		{
			kind: VaultActionKind.CreateFolder,
			payload: { splitPath: folder("Exemplar/Kohlekraftwerk/Sub") },
		},
		{
			kind: VaultActionKind.TrashFolder,
			payload: { splitPath: folder("Exemplar/Kohlekraftwerk") },
		},
		{
			kind: VaultActionKind.CreateFile,
			payload: { splitPath: file("Exemplar/Kohlekraftwerk/a.png") },
		},
		{
			kind: VaultActionKind.TrashFile,
			payload: { splitPath: file("Exemplar/Kohlekraftwerk/a.png") },
		},
		{
			kind: VaultActionKind.UpsertMdFile,
			payload: { content: "x", splitPath: md(inside) },
		},
		{
			kind: VaultActionKind.ProcessMdFile,
			payload: { splitPath: md(inside), transform: (c) => c },
		},
		{
			kind: VaultActionKind.TrashMdFile,
			payload: { splitPath: md(inside) },
		},
		{
			kind: VaultActionKind.RenameMdFile,
			payload: { from: md(inside), to: md("Worter/K.md") },
		},
		{
			kind: VaultActionKind.RenameMdFile,
			payload: {
				from: md("Worter/K.md"),
				to: md("Exemplar/Kohlekraftwerk/K.md"),
			},
		},
		{
			kind: VaultActionKind.RenameFile,
			payload: {
				from: file("Exemplar/Kohlekraftwerk/a.png"),
				to: file("a.png"),
			},
		},
		{
			kind: VaultActionKind.RenameFolder,
			payload: {
				from: folder("Elsewhere"),
				to: folder("Exemplar/Kohlekraftwerk/Elsewhere"),
			},
		},
	];

	for (const action of insideActions) {
		it(`refuses ${action.kind} inside the prefix`, () => {
			const violation = nested.findViolation([action]);
			expect(violation?.relation).toBe("inside");
			expect(violation?.prefix).toBe("Exemplar/Kohlekraftwerk");
			expect(violation?.action).toBe(action);
		});
	}

	it("refuses renaming or trashing a folder that contains the prefix", () => {
		const trashParent: VaultAction = {
			kind: VaultActionKind.TrashFolder,
			payload: { splitPath: folder("Exemplar") },
		};
		const renameParent: VaultAction = {
			kind: VaultActionKind.RenameFolder,
			payload: { from: folder("Exemplar"), to: folder("Archive") },
		};
		const trashRoot: VaultAction = {
			kind: VaultActionKind.TrashFolder,
			payload: { splitPath: splitPathCodec.root },
		};
		for (const action of [trashParent, renameParent]) {
			expect(nested.findViolation([action])).toEqual({
				action,
				path: "Exemplar",
				prefix: "Exemplar/Kohlekraftwerk",
				relation: "contains",
			});
		}
		expect(nested.findViolation([trashRoot])).toEqual({
			action: trashRoot,
			path: "",
			prefix: "Exemplar/Kohlekraftwerk",
			relation: "contains",
		});
	});

	it("allows actions beside the prefix and creating its parent folder", () => {
		const allowed: readonly VaultAction[] = [
			{
				kind: VaultActionKind.CreateFolder,
				payload: { splitPath: folder("Exemplar") },
			},
			{
				kind: VaultActionKind.UpsertMdFile,
				payload: { content: "x", splitPath: md("Exemplar/Other.md") },
			},
			{
				kind: VaultActionKind.UpsertMdFile,
				payload: {
					content: "x",
					splitPath: md("Exemplar/Kohlekraftwerks/K.md"),
				},
			},
			{
				kind: VaultActionKind.RenameFolder,
				payload: { from: folder("Worter"), to: folder("Wörter") },
			},
			{
				kind: VaultActionKind.TrashFolder,
				payload: { splitPath: folder("Exemplars") },
			},
		];
		expect(nested.findViolation(allowed)).toBeUndefined();
	});

	it("reports nothing when no prefix is configured", () => {
		expect(
			new ProtectedPaths().findViolation([
				{
					kind: VaultActionKind.TrashFolder,
					payload: { splitPath: splitPathCodec.root },
				},
			]),
		).toBeUndefined();
	});
});
