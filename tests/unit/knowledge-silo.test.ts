import { describe, expect, it } from "bun:test";
import {
	type AuthorStats,
	aggregateByModule,
	classifyModule,
	computeBusFactor,
	detectSilos,
	type FileStats,
	type ModuleStats,
} from "../../scripts/knowledge-silo";

// ── helpers ─────────────────────────────────────────────────────────────────

function makeAuthor(
	commits: number,
	opts?: Partial<AuthorStats>,
): AuthorStats {
	return {
		commits,
		lastCommitDate: opts?.lastCommitDate ?? new Date("2025-06-01"),
		linesAdded: opts?.linesAdded ?? commits * 10,
		linesDeleted: opts?.linesDeleted ?? commits * 2,
	};
}

// ── classifyModule ──────────────────────────────────────────────────────────

describe("classifyModule", () => {
	it("returns null for non-src paths", () => {
		expect(classifyModule("lib/foo/bar.ts")).toBeNull();
		expect(classifyModule("tests/unit/foo.test.ts")).toBeNull();
	});

	it("returns top-level module for generic src files", () => {
		expect(classifyModule("src/utils/helpers.ts")).toBe("src/utils");
		expect(classifyModule("src/types/index.ts")).toBe("src/types");
	});

	it("returns single-level for files directly under src/", () => {
		expect(classifyModule("src/main.ts")).toBe("src/main.ts");
	});

	it("uses two levels for commanders/", () => {
		expect(classifyModule("src/commanders/librarian/index.ts")).toBe(
			"src/commanders/librarian",
		);
		expect(classifyModule("src/commanders/textfresser/foo.ts")).toBe(
			"src/commanders/textfresser",
		);
	});

	it("uses two levels for managers/", () => {
		expect(classifyModule("src/managers/obsidian/vault.ts")).toBe(
			"src/managers/obsidian",
		);
	});

	it("uses two levels for prompt-smith known subdirs", () => {
		expect(classifyModule("src/prompt-smith/codegen/gen.ts")).toBe(
			"src/prompt-smith/codegen",
		);
		expect(classifyModule("src/prompt-smith/schemas/foo.ts")).toBe(
			"src/prompt-smith/schemas",
		);
		expect(classifyModule("src/prompt-smith/prompt-parts/bar.ts")).toBe(
			"src/prompt-smith/prompt-parts",
		);
	});

	it("uses two levels for unknown prompt-smith subdirs", () => {
		expect(classifyModule("src/prompt-smith/other/baz.ts")).toBe(
			"src/prompt-smith/other",
		);
	});
});

// ── computeBusFactor ────────────────────────────────────────────────────────

describe("computeBusFactor", () => {
	it("returns 0 for empty author map", () => {
		expect(computeBusFactor(new Map())).toBe(0);
	});

	it("returns 1 for a single author", () => {
		const authors = new Map([["alice", makeAuthor(50)]]);
		expect(computeBusFactor(authors)).toBe(1);
	});

	it("returns 1 when one author dominates", () => {
		const authors = new Map([
			["alice", makeAuthor(90)],
			["bob", makeAuthor(10)],
		]);
		expect(computeBusFactor(authors)).toBe(1);
	});

	it("returns 2 when two authors are needed for >50%", () => {
		const authors = new Map([
			["alice", makeAuthor(40)],
			["bob", makeAuthor(35)],
			["carol", makeAuthor(25)],
		]);
		// sorted: alice(40), bob(35), carol(25) — alice alone = 40% ≤ 50%, alice+bob = 75% > 50%
		expect(computeBusFactor(authors)).toBe(2);
	});

	it("returns 1 when top author has exactly >50%", () => {
		const authors = new Map([
			["alice", makeAuthor(51)],
			["bob", makeAuthor(49)],
		]);
		expect(computeBusFactor(authors)).toBe(1);
	});
});

// ── aggregateByModule ───────────────────────────────────────────────────────

describe("aggregateByModule", () => {
	it("aggregates files into their module", () => {
		const fileStats = new Map<string, FileStats>([
			[
				"src/utils/a.ts",
				{ authors: new Map([["alice", makeAuthor(5)]]) },
			],
			[
				"src/utils/b.ts",
				{ authors: new Map([["alice", makeAuthor(3)]]) },
			],
		]);

		const modules = aggregateByModule(fileStats);
		const utilsMod = modules.get("src/utils");
		expect(utilsMod).toBeDefined();
		expect(utilsMod!.files).toBe(2);
		expect(utilsMod!.authors.get("alice")!.commits).toBe(8);
	});

	it("skips non-src files", () => {
		const fileStats = new Map<string, FileStats>([
			[
				"tests/foo.ts",
				{ authors: new Map([["alice", makeAuthor(5)]]) },
			],
		]);

		const modules = aggregateByModule(fileStats);
		expect(modules.size).toBe(0);
	});

	it("merges multiple authors across files", () => {
		const fileStats = new Map<string, FileStats>([
			[
				"src/types/a.ts",
				{ authors: new Map([["alice", makeAuthor(10)]]) },
			],
			[
				"src/types/b.ts",
				{
					authors: new Map([
						["alice", makeAuthor(5)],
						["bob", makeAuthor(3)],
					]),
				},
			],
		]);

		const modules = aggregateByModule(fileStats);
		const typesMod = modules.get("src/types");
		expect(typesMod!.authors.size).toBe(2);
		expect(typesMod!.authors.get("alice")!.commits).toBe(15);
		expect(typesMod!.authors.get("bob")!.commits).toBe(3);
	});
});

// ── detectSilos ─────────────────────────────────────────────────────────────

describe("detectSilos", () => {
	const defaultConfig = { recencyDays: 90, siloThreshold: 80 };
	const now = new Date("2025-09-01");

	it("skips modules with fewer than 5 commits", () => {
		const modules = new Map<string, ModuleStats>([
			[
				"src/tiny",
				{ authors: new Map([["alice", makeAuthor(4)]]), files: 1 },
			],
		]);

		const silos = detectSilos(modules, defaultConfig, now);
		expect(silos).toHaveLength(0);
	});

	it("marks high risk when single author owns 100% and no other authors", () => {
		const modules = new Map<string, ModuleStats>([
			[
				"src/solo",
				{ authors: new Map([["alice", makeAuthor(20)]]), files: 3 },
			],
		]);

		const silos = detectSilos(modules, defaultConfig, now);
		expect(silos).toHaveLength(1);
		expect(silos[0]!.riskLevel).toBe("high");
		expect(silos[0]!.topAuthor).toBe("alice");
		expect(silos[0]!.topAuthorPct).toBe(100);
		expect(silos[0]!.busFactor).toBe(1);
	});

	it("marks medium risk when top author >= threshold but other author is recent", () => {
		const recentDate = new Date("2025-08-15"); // within 90 days of `now`
		const modules = new Map<string, ModuleStats>([
			[
				"src/mostly-one",
				{
					authors: new Map([
						["alice", makeAuthor(18)],
						["bob", makeAuthor(2, { lastCommitDate: recentDate })],
					]),
					files: 5,
				},
			],
		]);

		const silos = detectSilos(modules, defaultConfig, now);
		expect(silos).toHaveLength(1);
		expect(silos[0]!.riskLevel).toBe("medium");
	});

	it("marks low risk when no single author dominates", () => {
		const modules = new Map<string, ModuleStats>([
			[
				"src/shared",
				{
					authors: new Map([
						["alice", makeAuthor(10)],
						["bob", makeAuthor(8)],
						["carol", makeAuthor(7)],
					]),
					files: 5,
				},
			],
		]);

		const silos = detectSilos(modules, defaultConfig, now);
		expect(silos).toHaveLength(1);
		expect(silos[0]!.riskLevel).toBe("low");
	});

	it("sorts results by risk level then by topAuthorPct descending", () => {
		const modules = new Map<string, ModuleStats>([
			[
				"src/low-risk",
				{
					authors: new Map([
						["alice", makeAuthor(10)],
						["bob", makeAuthor(8)],
						["carol", makeAuthor(7)],
					]),
					files: 5,
				},
			],
			[
				"src/high-risk",
				{
					authors: new Map([["alice", makeAuthor(20)]]),
					files: 3,
				},
			],
		]);

		const silos = detectSilos(modules, defaultConfig, now);
		expect(silos[0]!.module).toBe("src/high-risk");
		expect(silos[1]!.module).toBe("src/low-risk");
	});
});
