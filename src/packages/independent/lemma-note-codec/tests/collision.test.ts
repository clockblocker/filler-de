import { describe, expect, it } from "bun:test";
import { caseFold, findPathCollisions, pathCollisionKey } from "../src";

describe("caseFold", () => {
	it("folds as Python's str.casefold does", () => {
		const casefold: readonly [string, string][] = [
			["Maße", "masse"],
			["MAẞE", "masse"],
			["MASSE", "masse"],
			["ß", "ss"],
			["ẞ", "ss"],
			["ﬁ", "fi"],
			["ﬃ", "ffi"],
			["ŉ", "ʼn"],
			["Σ", "σ"],
			["ς", "σ"],
			["µ", "μ"],
			["ſ", "s"],
			["K", "k"],
			["İ", "i̇"],
			["ᾳ", "αι"],
			["Ǆ", "ǆ"],
			["ǅ", "ǆ"],
			["Mütter", "mütter"],
			["🚗 Fahrer", "🚗 fahrer"],
		];
		for (const [text, folded] of casefold)
			expect([text, caseFold(text)]).toEqual([
				text,
				folded.normalize("NFC"),
			]);
	});

	it("keeps the dotless ı apart from i, as full folding does", () => {
		expect(caseFold("ı")).toBe("ı");
		expect(caseFold("I")).toBe("i");
	});

	it("gives every case variant of a Cherokee or Georgian letter one form", () => {
		expect(caseFold("Ꭰ")).toBe(caseFold("ꭰ"));
		expect(caseFold("Ა")).toBe(caseFold("ა"));
	});
});

describe("pathCollisionKey", () => {
	it("matches APFS on the measured pairs", () => {
		const same: readonly [string, string][] = [
			["Maße.md", "Masse.md"],
			["Maße.md", "MAẞE.md"],
			["Maße.md", "MASSE.md"],
			["Mütter.md", "Mütter.md"],
			["Morgen.md", "morgen.md"],
		];
		for (const [left, right] of same)
			expect(pathCollisionKey(left)).toBe(pathCollisionKey(right));
		expect(pathCollisionKey("Mütter.md")).not.toBe(
			pathCollisionKey("Mutter.md"),
		);
	});
});

describe("findPathCollisions", () => {
	it("reports two owners of one file under different spellings", () => {
		expect(
			findPathCollisions([
				{ owner: "Maße", path: "Worter/x/Maße.md" },
				{ owner: "Masse", path: "Worter/x/Masse.md" },
			]),
		).toEqual([
			{
				component: "file",
				first: { owner: "Maße", path: "Worter/x/Maße.md" },
				key: "worter/x/masse.md",
				second: { owner: "Masse", path: "Worter/x/Masse.md" },
			},
		]);
	});

	it("reports two owners of one exact path", () => {
		expect(
			findPathCollisions([
				{ owner: "C#", path: "Worter/c/c/c/C.md" },
				{ owner: "C", path: "Worter/c/c/c/C.md" },
			]),
		).toMatchObject([{ component: "file", key: "worter/c/c/c/c.md" }]);
	});

	it("reports an NFD spelling of another owner's path", () => {
		expect(
			findPathCollisions([
				{ owner: "a", path: "Worter/Mütter.md" },
				{ owner: "b", path: "Worter/Mütter.md" },
			]),
		).toHaveLength(1);
	});

	it("never reports one owner's own claims", () => {
		expect(
			findPathCollisions([
				{ owner: "lol", path: "Worter/l/lol/lol/LOL.md" },
				{ owner: "lol", path: "Worter/l/lol/lol/lol.md" },
				{ owner: "lol", path: "Worter/l/lol/lol/lol.md" },
			]),
		).toEqual([]);
	});

	it("checks every folder, from the root down", () => {
		const collisions = findPathCollisions([
			{ owner: "a", path: "Worter/de/Lexeme/VERB/über/a.md" },
			{ owner: "b", path: "worter/de/Lexeme/VERB/Über/b.md" },
		]);
		expect(
			collisions.map(({ component, first, second }) => [
				component,
				first.path,
				second.path,
			]),
		).toEqual([["folder", "Worter", "worter"]]);
		const slot = findPathCollisions([
			{ owner: "a", path: "Worter/de/Lexeme/VERB/über/a.md" },
			{ owner: "b", path: "Worter/de/Lexeme/VERB/Über/b.md" },
		]);
		expect(
			slot.map(({ component, first, second }) => [
				component,
				first.path,
				second.path,
			]),
		).toEqual([
			[
				"folder",
				"Worter/de/Lexeme/VERB/über",
				"Worter/de/Lexeme/VERB/Über",
			],
		]);
	});

	it("finds a folder collision deep in the tree whose files differ", () => {
		const collisions = findPathCollisions([
			{ owner: "a", path: "Worter/m/maß/Maße.md" },
			{ owner: "b", path: "Worter/m/MASS/Masse.md" },
		]);
		expect(collisions).toEqual([
			{
				component: "folder",
				first: { owner: "a", path: "Worter/m/maß" },
				key: "worter/m/mass",
				second: { owner: "b", path: "Worter/m/MASS" },
			},
			{
				component: "file",
				first: { owner: "a", path: "Worter/m/maß/Maße.md" },
				key: "worter/m/mass/masse.md",
				second: { owner: "b", path: "Worter/m/MASS/Masse.md" },
			},
		]);
	});

	it("reports each new spelling of a folder once", () => {
		const collisions = findPathCollisions([
			{ owner: "a", path: "Worter/Foo/a.md" },
			{ owner: "b", path: "Worter/foo/b.md" },
			{ owner: "c", path: "Worter/foo/c.md" },
			{ owner: "d", path: "Worter/FOO/d.md" },
		]);
		expect(collisions.map(({ second }) => second.path)).toEqual([
			"Worter/foo",
			"Worter/FOO",
		]);
	});

	it("reports nothing for paths that differ under the key", () => {
		expect(
			findPathCollisions([
				{ owner: "a", path: "Worter/m/maß/maße/Maße.md" },
				{ owner: "b", path: "Worter/m/mas/masse/Masse.md" },
				{ owner: "c", path: "Worter/m/mut/mutte/Mutter.md" },
				{ owner: "d", path: "Worter/m/müt/mütte/Mütter.md" },
			]),
		).toEqual([]);
	});
});
