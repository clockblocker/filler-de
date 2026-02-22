#!/usr/bin/env bun

/**
 * Knowledge Silo Detector
 *
 * Analyzes git history to detect modules where a single contributor dominates
 * ownership, indicating a "knowledge silo" risk (low bus factor).
 *
 * Usage: bun scripts/knowledge-silo.ts [--days=N] [--threshold=N] [--json] [--output=<path>]
 *   --days       Recency window for silo detection (default: 90)
 *   --threshold  Ownership % above which a single author is flagged (default: 80)
 *   --json       Output machine-readable JSON instead of markdown
 *   --output     Write output to a file instead of stdout
 */

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { $ } from "bun";

// ── Config ──────────────────────────────────────────────────────────────────

export interface CliArgs {
	recencyDays: number;
	siloThreshold: number;
	json: boolean;
	output: string | null;
}

function parseArgs(): CliArgs {
	const args = process.argv.slice(2);
	let recencyDays = 90;
	let siloThreshold = 80;
	let json = false;
	let output: string | null = null;

	for (const arg of args) {
		const daysMatch = arg.match(/^--days=(\d+)$/);
		if (daysMatch) {
			recencyDays = Number(daysMatch[1]);
			continue;
		}
		const thresholdMatch = arg.match(/^--threshold=(\d+)$/);
		if (thresholdMatch) {
			siloThreshold = Number(thresholdMatch[1]);
			continue;
		}
		if (arg === "--json") {
			json = true;
			continue;
		}
		const outputMatch = arg.match(/^--output=(.+)$/);
		if (outputMatch) {
			output = outputMatch[1]!;
			continue;
		}
	}

	return { json, output, recencyDays, siloThreshold };
}

// ── Types ───────────────────────────────────────────────────────────────────

export interface AuthorStats {
	linesAdded: number;
	linesDeleted: number;
	commits: number;
	lastCommitDate: Date;
}

export interface FileStats {
	authors: Map<string, AuthorStats>;
}

export interface ModuleStats {
	files: number;
	authors: Map<string, AuthorStats>;
}

export interface SiloReport {
	module: string;
	busFactor: number;
	topAuthor: string;
	topAuthorPct: number;
	totalCommits: number;
	totalLines: number;
	lastOtherAuthorDate: Date | null;
	daysSinceOtherAuthor: number | null;
	riskLevel: "high" | "medium" | "low";
}

// ── Module Classification ───────────────────────────────────────────────────

/** Maps a file path to its logical module name (2-level deep for key dirs). */
export function classifyModule(filePath: string): string | null {
	if (!filePath.startsWith("src/")) return null;

	const parts = filePath.replace("src/", "").split("/");
	if (parts.length < 2) return `src/${parts[0]}`;

	const topDir = parts[0];

	// For commanders/ and managers/, use two levels (e.g. commanders/librarian)
	if (
		(topDir === "commanders" || topDir === "managers") &&
		parts.length >= 2
	) {
		return `src/${topDir}/${parts[1]}`;
	}

	// For prompt-smith/codegen vs prompt-smith/other
	if (topDir === "prompt-smith" && parts.length >= 2) {
		if (parts[1] === "codegen") return "src/prompt-smith/codegen";
		if (parts[1] === "schemas") return "src/prompt-smith/schemas";
		if (parts[1] === "prompt-parts") return "src/prompt-smith/prompt-parts";
		return `src/prompt-smith/${parts[1]}`;
	}

	// Everything else: top-level module
	return `src/${topDir}`;
}

// ── Git Log Parsing ─────────────────────────────────────────────────────────

async function parseGitLog(): Promise<Map<string, FileStats>> {
	const result =
		await $`git log --numstat --format="COMMIT:%H|%an|%aI" --no-merges -- "src/**"`.text();

	const fileStats = new Map<string, FileStats>();

	let currentAuthor = "";
	let currentDate = new Date();

	for (const line of result.split("\n")) {
		if (line.startsWith("COMMIT:")) {
			const parts = line.replace("COMMIT:", "").split("|");
			currentAuthor = parts[1] ?? "unknown";
			currentDate = new Date(parts[2] ?? "");
			continue;
		}

		// numstat lines: <added>\t<deleted>\t<filepath>
		const numstatMatch = line.match(/^(\d+|-)\t(\d+|-)\t(.+)$/);
		if (!numstatMatch) continue;

		const added = numstatMatch[1] === "-" ? 0 : Number(numstatMatch[1]);
		const deleted = numstatMatch[2] === "-" ? 0 : Number(numstatMatch[2]);
		const filePath = numstatMatch[3]!;

		if (!filePath.startsWith("src/")) continue;

		// Skip git rename paths (e.g. "src/{foo => bar}/file.ts")
		if (filePath.includes("=>") || filePath.includes("{")) continue;

		let stats = fileStats.get(filePath);
		if (!stats) {
			stats = { authors: new Map() };
			fileStats.set(filePath, stats);
		}

		let authorStats = stats.authors.get(currentAuthor);
		if (!authorStats) {
			authorStats = {
				commits: 0,
				lastCommitDate: currentDate,
				linesAdded: 0,
				linesDeleted: 0,
			};
			stats.authors.set(currentAuthor, authorStats);
		}

		authorStats.linesAdded += added;
		authorStats.linesDeleted += deleted;
		authorStats.commits += 1;
		if (currentDate > authorStats.lastCommitDate) {
			authorStats.lastCommitDate = currentDate;
		}
	}

	return fileStats;
}

// ── Aggregation ─────────────────────────────────────────────────────────────

export function aggregateByModule(
	fileStats: Map<string, FileStats>,
): Map<string, ModuleStats> {
	const modules = new Map<string, ModuleStats>();

	for (const [filePath, fStats] of fileStats) {
		const moduleName = classifyModule(filePath);
		if (!moduleName) continue;

		let mod = modules.get(moduleName);
		if (!mod) {
			mod = { authors: new Map(), files: 0 };
			modules.set(moduleName, mod);
		}
		mod.files++;

		for (const [author, aStats] of fStats.authors) {
			let modAuthor = mod.authors.get(author);
			if (!modAuthor) {
				modAuthor = {
					commits: 0,
					lastCommitDate: aStats.lastCommitDate,
					linesAdded: 0,
					linesDeleted: 0,
				};
				mod.authors.set(author, modAuthor);
			}
			modAuthor.linesAdded += aStats.linesAdded;
			modAuthor.linesDeleted += aStats.linesDeleted;
			modAuthor.commits += aStats.commits;
			if (aStats.lastCommitDate > modAuthor.lastCommitDate) {
				modAuthor.lastCommitDate = aStats.lastCommitDate;
			}
		}
	}

	return modules;
}

// ── Bus Factor Calculation ──────────────────────────────────────────────────

/**
 * Bus factor = minimum number of authors whose combined commit share
 * exceeds 50% of the module's total commits.
 */
export function computeBusFactor(authors: Map<string, AuthorStats>): number {
	const totalCommits = [...authors.values()].reduce(
		(sum, a) => sum + a.commits,
		0,
	);
	if (totalCommits === 0) return 0;

	const sorted = [...authors.entries()].sort(
		(a, b) => b[1].commits - a[1].commits,
	);
	let accumulated = 0;
	let count = 0;
	for (const [, stats] of sorted) {
		accumulated += stats.commits;
		count++;
		if (accumulated > totalCommits * 0.5) break;
	}
	return count;
}

// ── Silo Detection ─────────────────────────────────────────────────────────

export function detectSilos(
	modules: Map<string, ModuleStats>,
	config: Pick<CliArgs, "recencyDays" | "siloThreshold">,
	now: Date = new Date(),
): SiloReport[] {
	const reports: SiloReport[] = [];

	for (const [moduleName, mod] of modules) {
		const totalCommits = [...mod.authors.values()].reduce(
			(sum, a) => sum + a.commits,
			0,
		);
		const totalLines = [...mod.authors.values()].reduce(
			(sum, a) => sum + a.linesAdded + a.linesDeleted,
			0,
		);

		if (totalCommits < 5) continue; // skip trivial modules

		const busFactor = computeBusFactor(mod.authors);

		// Find top author by commits
		const sorted = [...mod.authors.entries()].sort(
			(a, b) => b[1].commits - a[1].commits,
		);
		const topEntry = sorted[0];
		if (!topEntry) continue;
		const [topAuthor, topStats] = topEntry;
		const topAuthorPct = (topStats.commits / totalCommits) * 100;

		// Find last commit date by any non-top author
		let lastOtherAuthorDate: Date | null = null;
		for (const [author, stats] of mod.authors) {
			if (author === topAuthor) continue;
			if (!lastOtherAuthorDate || stats.lastCommitDate > lastOtherAuthorDate) {
				lastOtherAuthorDate = stats.lastCommitDate;
			}
		}

		const daysSinceOtherAuthor = lastOtherAuthorDate
			? Math.floor(
					(now.getTime() - lastOtherAuthorDate.getTime()) / (1000 * 3600 * 24),
				)
			: null;

		// Risk assessment
		let riskLevel: SiloReport["riskLevel"] = "low";
		if (topAuthorPct >= config.siloThreshold) {
			if (
				daysSinceOtherAuthor === null ||
				daysSinceOtherAuthor > config.recencyDays
			) {
				riskLevel = "high";
			} else {
				riskLevel = "medium";
			}
		} else if (busFactor <= 1) {
			riskLevel = "medium";
		}

		reports.push({
			busFactor,
			daysSinceOtherAuthor,
			lastOtherAuthorDate,
			module: moduleName,
			riskLevel,
			topAuthor,
			topAuthorPct,
			totalCommits,
			totalLines,
		});
	}

	return reports.sort((a, b) => {
		const riskOrder = { high: 0, low: 2, medium: 1 };
		if (riskOrder[a.riskLevel] !== riskOrder[b.riskLevel]) {
			return riskOrder[a.riskLevel] - riskOrder[b.riskLevel];
		}
		return b.topAuthorPct - a.topAuthorPct;
	});
}

// ── Markdown Report ─────────────────────────────────────────────────────────

function formatReport(reports: SiloReport[], config: CliArgs): string {
	const lines: string[] = [];

	lines.push("# Knowledge Silo Analysis");
	lines.push("");
	lines.push(
		`> Generated: ${new Date().toISOString().split("T")[0]} | Silo threshold: ${config.siloThreshold}% | Recency window: ${config.recencyDays} days`,
	);
	lines.push("");

	// ── Bus Factor Table ──
	lines.push("## Per-Module Bus Factor");
	lines.push("");
	lines.push(
		"| Module | Bus Factor | Top Author | Top % | Commits | Lines |",
	);
	lines.push(
		"|--------|----------:|-----------:|------:|--------:|------:|",
	);

	for (const r of reports) {
		lines.push(
			`| ${r.module} | ${r.busFactor} | ${r.topAuthor} | ${r.topAuthorPct.toFixed(1)}% | ${r.totalCommits} | ${r.totalLines} |`,
		);
	}
	lines.push("");

	// ── Knowledge Silos ──
	const silos = reports.filter((r) => r.riskLevel !== "low");

	lines.push("## Identified Knowledge Silos");
	lines.push("");

	if (silos.length === 0) {
		lines.push("No knowledge silos detected with current thresholds.");
	} else {
		for (const s of silos) {
			const riskEmoji =
				s.riskLevel === "high" ? "🔴" : s.riskLevel === "medium" ? "🟡" : "🟢";
			lines.push(`### ${riskEmoji} ${s.module} — ${s.riskLevel.toUpperCase()}`);
			lines.push("");
			lines.push(`- **Top author**: ${s.topAuthor} (${s.topAuthorPct.toFixed(1)}% of commits)`);
			lines.push(`- **Bus factor**: ${s.busFactor}`);
			lines.push(`- **Total commits**: ${s.totalCommits}`);
			if (s.daysSinceOtherAuthor !== null) {
				lines.push(
					`- **Last other-author commit**: ${s.daysSinceOtherAuthor} days ago`,
				);
			} else {
				lines.push("- **Last other-author commit**: never");
			}
			lines.push("");
		}
	}

	// ── Recommendations ──
	lines.push("## Recommended Cross-Training Areas");
	lines.push("");

	const highRisk = reports.filter((r) => r.riskLevel === "high");
	const mediumRisk = reports.filter((r) => r.riskLevel === "medium");

	if (highRisk.length > 0) {
		lines.push("**Priority 1 — Immediate attention:**");
		for (const r of highRisk) {
			lines.push(
				`- \`${r.module}\`: Only ${r.topAuthor} has meaningful ownership. Pair-program or do code reviews with a second contributor.`,
			);
		}
		lines.push("");
	}

	if (mediumRisk.length > 0) {
		lines.push("**Priority 2 — Monitor:**");
		for (const r of mediumRisk) {
			lines.push(
				`- \`${r.module}\`: Bus factor is ${r.busFactor}. Encourage contributions from additional team members.`,
			);
		}
		lines.push("");
	}

	if (highRisk.length === 0 && mediumRisk.length === 0) {
		lines.push(
			"All modules have adequate contributor diversity. No immediate action needed.",
		);
		lines.push("");
	}

	return lines.join("\n");
}

// ── JSON Report ─────────────────────────────────────────────────────────────

function formatJson(reports: SiloReport[]): string {
	return JSON.stringify(
		reports.map((r) => ({
			...r,
			lastOtherAuthorDate: r.lastOtherAuthorDate?.toISOString() ?? null,
		})),
		null,
		2,
	);
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
	const config = parseArgs();

	const fileStats = await parseGitLog();
	const modules = aggregateByModule(fileStats);

	// Filter to modules that still exist on disk
	for (const moduleName of [...modules.keys()]) {
		if (!existsSync(moduleName)) {
			modules.delete(moduleName);
		}
	}

	const reports = detectSilos(modules, config);
	const output = config.json
		? formatJson(reports)
		: formatReport(reports, config);

	if (config.output) {
		const dir = dirname(config.output);
		if (!existsSync(dir)) {
			mkdirSync(dir, { recursive: true });
		}
		writeFileSync(config.output, output, "utf-8");
		console.log(`Report written to ${config.output}`);
	} else {
		console.log(output);
	}
}

// Only run main when executed directly (not imported for tests)
if (import.meta.main) {
	main().catch((err) => {
		console.error("Failed to run knowledge silo analysis:", err);
		process.exit(1);
	});
}
