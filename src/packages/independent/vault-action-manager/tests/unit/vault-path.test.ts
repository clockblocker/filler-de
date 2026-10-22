import { describe, expect, it } from "bun:test";
import type { TAbstractFile, Vault } from "obsidian";
import {
	getAbstractFileByPath,
	toSystemPath,
} from "../../src/internal/abstract-file-by-path";
import { detectVaultFileSystem } from "../../src/internal/file-system-case";
import { VaultPath } from "../../src/vault-path";

const NFC = "Mütter";
const NFD = "Mütter";

describe("VaultPath.normalize", () => {
	it("normalizes as Obsidian's normalizePath, with the root as an empty string", () => {
		expect(VaultPath.normalize("/Worter//de\\a.md/")).toBe(
			"Worter/de/a.md",
		);
		expect(VaultPath.normalize("\\\\")).toBe("");
		expect(VaultPath.normalize("/")).toBe("");
		expect(VaultPath.normalize("")).toBe(VaultPath.root);
		expect(VaultPath.normalize(`${NFD}/a b c.md`)).toBe(`${NFC}/a b c.md`);
	});

	it("keeps case", () => {
		expect(VaultPath.normalize("Worter/A.md")).toBe("Worter/A.md");
	});
});

describe("VaultPath.join", () => {
	it("joins segments below one another, skipping empty ones", () => {
		expect(VaultPath.join("Worter", "de", "a.md")).toBe("Worter/de/a.md");
		expect(VaultPath.join("", "Library")).toBe("Library");
		expect(VaultPath.join("Worter/", "/de")).toBe("Worter/de");
		expect(VaultPath.join()).toBe("");
	});
});

describe("VaultPath.caseSensitive", () => {
	const paths = VaultPath.caseSensitive;

	it("treats spellings Obsidian keys alike as one path", () => {
		expect(paths.same("/Worter/a.md", "Worter//a.md")).toBe(true);
		expect(paths.same(`${NFD}.md`, `${NFC}.md`)).toBe(true);
		expect(paths.same("", "/")).toBe(true);
	});

	it("tells paths apart that differ only in case", () => {
		expect(paths.same("Worter/a.md", "worter/a.md")).toBe(false);
		expect(paths.key("Worter/A.md")).toBe("Worter/A.md");
		expect(
			paths.isUnder("worter/a.md", "Worter", { inclusive: false }),
		).toBe(false);
	});

	it("matches whole segments only", () => {
		const under = (path: string) =>
			paths.isUnder(path, "Worter", { inclusive: false });
		expect(under("Worter/a.md")).toBe(true);
		expect(under("Worter/de/a.md")).toBe(true);
		expect(under("/Worter/a.md")).toBe(true);
		expect(under("Worterbuch/a.md")).toBe(false);
		expect(under("Worter.md")).toBe(false);
		expect(under("Notes/Worter/a.md")).toBe(false);
		expect(under("Worte")).toBe(false);
	});

	it("covers the prefix itself only when inclusive", () => {
		expect(paths.isUnder("Worter", "Worter", { inclusive: true })).toBe(
			true,
		);
		expect(paths.isUnder("Worter/", "/Worter", { inclusive: false })).toBe(
			false,
		);
	});

	it("puts every other path under the root", () => {
		expect(paths.isUnder("a.md", "", { inclusive: false })).toBe(true);
		expect(paths.isUnder("a/b.md", "/", { inclusive: false })).toBe(true);
		expect(paths.isUnder("", "", { inclusive: false })).toBe(false);
		expect(paths.isUnder("/", "", { inclusive: true })).toBe(true);
		expect(paths.isUnder("", "Worter", { inclusive: true })).toBe(false);
	});
});

describe("VaultPath.caseInsensitive", () => {
	const paths = VaultPath.caseInsensitive;

	it("treats paths that differ only in case as one file", () => {
		expect(paths.same("Worter/a.md", "WORTER/A.md")).toBe(true);
		expect(paths.same(`${NFD}.md`, "MÜTTER.md")).toBe(true);
		expect(paths.key("/Worter/A.md")).toBe("worter/a.md");
		expect(
			paths.isUnder("worter/a.md", "Worter", { inclusive: false }),
		).toBe(true);
		expect(
			paths.isUnder("WORTERBUCH/a.md", "Worter", { inclusive: true }),
		).toBe(false);
	});
});

describe("VaultPath.forFileSystem", () => {
	it("picks the identity of the file system's case policy", () => {
		expect(VaultPath.forFileSystem({ caseInsensitive: true })).toBe(
			VaultPath.caseInsensitive,
		);
		expect(VaultPath.forFileSystem({ caseInsensitive: false })).toBe(
			VaultPath.caseSensitive,
		);
	});
});

describe("detectVaultFileSystem", () => {
	const appWith = (adapter: unknown) =>
		({ vault: { adapter } }) as Parameters<typeof detectVaultFileSystem>[0];

	it("reads Obsidian's probe of the vault folder", () => {
		expect(detectVaultFileSystem(appWith({ insensitive: true }))).toEqual({
			caseInsensitive: true,
		});
		expect(detectVaultFileSystem(appWith({ insensitive: false }))).toEqual({
			caseInsensitive: false,
		});
	});

	it("falls back to the platform when the adapter has no probe", () => {
		const platform = process.platform;
		expect(detectVaultFileSystem(appWith({}))).toEqual({
			caseInsensitive: platform === "darwin" || platform === "win32",
		});
		expect(detectVaultFileSystem(appWith(undefined))).toEqual(
			detectVaultFileSystem(appWith({ insensitive: "yes" })),
		);
	});

	it("assumes case is ignored off desktop, where the flag is not probed", () => {
		const original = Object.getOwnPropertyDescriptor(globalThis, "process");
		Object.defineProperty(globalThis, "process", {
			configurable: true,
			value: undefined,
		});
		try {
			expect(
				detectVaultFileSystem(appWith({ insensitive: false })),
			).toEqual({ caseInsensitive: true });
			expect(detectVaultFileSystem(appWith(undefined))).toEqual({
				caseInsensitive: true,
			});
		} finally {
			if (original)
				Object.defineProperty(globalThis, "process", original);
		}
	});
});

describe("toSystemPath and getAbstractFileByPath", () => {
	const root = { path: "/" } as TAbstractFile;
	const note = { path: `Worter/${NFC}.md` } as TAbstractFile;
	const looked: string[] = [];
	const vault = {
		getAbstractFileByPath: (path: string) => {
			looked.push(path);
			return path === note.path ? note : null;
		},
		getRoot: () => root,
	} as Pick<Vault, "getAbstractFileByPath" | "getRoot">;

	it("keys the root as Obsidian does and finds it through getRoot", () => {
		expect(toSystemPath("")).toBe(toSystemPath("/"));
		expect(String(toSystemPath(""))).toBe("/");
		expect(getAbstractFileByPath(vault, toSystemPath(""))).toBe(root);
	});

	it("finds a note whatever its Unicode composition or stray slashes", () => {
		expect(
			getAbstractFileByPath(vault, toSystemPath(`/Worter//${NFD}.md`)),
		).toBe(note);
	});

	it("stays case-sensitive, as Obsidian's lookup is", () => {
		looked.length = 0;
		expect(
			getAbstractFileByPath(vault, toSystemPath(`worter/${NFC}.md`)),
		).toBeNull();
		expect(looked).toEqual([`worter/${NFC}.md`]);
	});
});
