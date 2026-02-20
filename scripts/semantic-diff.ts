#!/usr/bin/env bun

/**
 * Semantic Diff Explainer
 *
 * Takes a git diff between two refs and produces a semantic explanation
 * of what changed and why, using the Gemini API.
 *
 * Usage: bun scripts/semantic-diff.ts [--base=REF] [--head=REF] [--no-ai]
 *   --base    Base ref for diff (default: master)
 *   --head    Head ref for diff (default: HEAD)
 *   --no-ai   Skip AI explanation, output structured diff summary only
 */

import { $ } from "bun";

// ── Config ──────────────────────────────────────────────────────────────────

interface CliArgs {
	base: string;
	head: string;
	noAi: boolean;
}

function parseArgs(): CliArgs {
	const args = process.argv.slice(2);
	let base = "master";
	let head = "HEAD";
	let noAi = false;

	for (const arg of args) {
		const baseMatch = arg.match(/^--base=(.+)$/);
		if (baseMatch) {
			base = baseMatch[1]!;
			continue;
		}
		const headMatch = arg.match(/^--head=(.+)$/);
		if (headMatch) {
			head = headMatch[1]!;
			continue;
		}
		if (arg === "--no-ai") {
			noAi = true;
		}
	}

	return { base, head, noAi };
}

// ── Types ───────────────────────────────────────────────────────────────────

type ChangeKind = "added" | "modified" | "deleted" | "renamed";

interface FileDiff {
	path: string;
	kind: ChangeKind;
	additions: number;
	deletions: number;
	patch: string;
}

interface ModuleChanges {
	module: string;
	files: FileDiff[];
	totalAdditions: number;
	totalDeletions: number;
}

interface SemanticExplanation {
	module: string;
	summary: string;
	details: string;
}

// ── Module Classification ───────────────────────────────────────────────────

function classifyModule(filePath: string): string {
	if (filePath.startsWith("src/")) {
		const parts = filePath.replace("src/", "").split("/");
		if (parts.length < 2) return `src/${parts[0]}`;

		const topDir = parts[0];

		if (
			(topDir === "commanders" || topDir === "managers") &&
			parts.length >= 2
		) {
			return `src/${topDir}/${parts[1]}`;
		}

		if (topDir === "prompt-smith" && parts.length >= 2) {
			if (parts[1] === "codegen") return "src/prompt-smith/codegen";
			if (parts[1] === "schemas") return "src/prompt-smith/schemas";
			if (parts[1] === "prompt-parts") return "src/prompt-smith/prompt-parts";
			return `src/prompt-smith/${parts[1]}`;
		}

		return `src/${topDir}`;
	}

	if (filePath.startsWith("tests/")) {
		const parts = filePath.replace("tests/", "").split("/");
		return `tests/${parts[0]}`;
	}

	if (filePath.startsWith("scripts/")) return "scripts";

	// Root-level files (package.json, tsconfig, etc.)
	return "root";
}

// ── Git Diff Extraction ─────────────────────────────────────────────────────

async function getDiffStat(
	base: string,
	head: string,
): Promise<Map<string, { additions: number; deletions: number }>> {
	const stat = await $`git diff --numstat ${base}...${head}`.text();
	const result = new Map<string, { additions: number; deletions: number }>();

	for (const line of stat.trim().split("\n")) {
		if (!line) continue;
		const match = line.match(/^(\d+|-)\t(\d+|-)\t(.+)$/);
		if (!match) continue;

		const additions = match[1] === "-" ? 0 : Number(match[1]);
		const deletions = match[2] === "-" ? 0 : Number(match[2]);
		const filePath = match[3]!;

		result.set(filePath, { additions, deletions });
	}

	return result;
}

async function getFileDiffs(base: string, head: string): Promise<FileDiff[]> {
	const stat = await getDiffStat(base, head);

	// Get the full diff
	const diffOutput = await $`git diff ${base}...${head}`.text();

	// Parse diff into per-file patches
	const fileDiffs: FileDiff[] = [];
	const diffSections = diffOutput.split(/^diff --git /m).slice(1);

	for (const section of diffSections) {
		const fullPatch = `diff --git ${section}`;
		const headerMatch = section.match(/^a\/(.+?) b\/(.+)/);
		if (!headerMatch) continue;

		const aPath = headerMatch[1]!;
		const bPath = headerMatch[2]!.split("\n")[0]!;

		let kind: ChangeKind = "modified";
		if (section.includes("new file mode")) {
			kind = "added";
		} else if (section.includes("deleted file mode")) {
			kind = "deleted";
		} else if (aPath !== bPath || section.includes("rename from")) {
			kind = "renamed";
		}

		const filePath = kind === "deleted" ? aPath : bPath;
		const stats = stat.get(filePath) ?? { additions: 0, deletions: 0 };

		fileDiffs.push({
			additions: stats.additions,
			deletions: stats.deletions,
			kind,
			patch: fullPatch,
			path: filePath,
		});
	}

	return fileDiffs;
}

// ── Change Grouping ─────────────────────────────────────────────────────────

function groupByModule(files: FileDiff[]): ModuleChanges[] {
	const grouped = new Map<string, FileDiff[]>();

	for (const file of files) {
		const mod = classifyModule(file.path);
		let group = grouped.get(mod);
		if (!group) {
			group = [];
			grouped.set(mod, group);
		}
		group.push(file);
	}

	const result: ModuleChanges[] = [];
	for (const [module, moduleFiles] of grouped) {
		const totalAdditions = moduleFiles.reduce(
			(sum, f) => sum + f.additions,
			0,
		);
		const totalDeletions = moduleFiles.reduce(
			(sum, f) => sum + f.deletions,
			0,
		);
		result.push({ files: moduleFiles, module, totalAdditions, totalDeletions });
	}

	return result.sort(
		(a, b) =>
			b.totalAdditions + b.totalDeletions - (a.totalAdditions + a.totalDeletions),
	);
}

// ── Diff Chunking ───────────────────────────────────────────────────────────

const MAX_CHUNK_CHARS = 28_000; // Stay well within Gemini token limits

function chunkModuleDiffs(modules: ModuleChanges[]): string[] {
	const chunks: string[] = [];
	let current = "";

	for (const mod of modules) {
		const header = `\n## Module: ${mod.module}\n`;
		for (const file of mod.files) {
			const entry = `${header}### ${file.kind}: ${file.path} (+${file.additions} -${file.deletions})\n\`\`\`diff\n${file.patch}\n\`\`\`\n`;

			if (current.length + entry.length > MAX_CHUNK_CHARS) {
				if (current) chunks.push(current);
				// If a single entry exceeds the limit, truncate the patch
				if (entry.length > MAX_CHUNK_CHARS) {
					const truncated = `${header}### ${file.kind}: ${file.path} (+${file.additions} -${file.deletions})\n\`\`\`diff\n${file.patch.slice(0, MAX_CHUNK_CHARS - 500)}\n... (truncated)\n\`\`\`\n`;
					chunks.push(truncated);
					current = "";
				} else {
					current = entry;
				}
			} else {
				current += entry;
			}
		}
	}
	if (current) chunks.push(current);

	return chunks;
}

// ── Gemini API ──────────────────────────────────────────────────────────────

const GEMINI_MODEL = "gemini-2.0-flash";

async function callGemini(prompt: string): Promise<string> {
	const apiKey = process.env.GOOGLE_API_KEY;
	if (!apiKey) {
		throw new Error("GOOGLE_API_KEY environment variable is not set");
	}

	const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

	const res = await fetch(url, {
		body: JSON.stringify({
			contents: [{ parts: [{ text: prompt }], role: "user" }],
			generationConfig: {
				maxOutputTokens: 2048,
				temperature: 0.3,
			},
		}),
		headers: {
			"content-type": "application/json",
			"x-goog-api-key": apiKey,
		},
		method: "POST",
	});

	if (!res.ok) {
		const text = await res.text();
		throw new Error(`Gemini API error ${res.status}: ${text}`);
	}

	const data = (await res.json()) as {
		candidates?: { content?: { parts?: { text?: string }[] } }[];
	};

	const text =
		data.candidates?.[0]?.content?.parts?.[0]?.text ?? "(no response)";
	return text;
}

const SYSTEM_PROMPT = `You are a senior software engineer reviewing a code diff. Analyze the changes and provide:

1. A one-line summary of what this change does semantically (the "why", not just "modified X")
2. A concise breakdown covering:
   - What behavior changed
   - Any API surface or interface changes
   - Potential risks or breaking changes
   - Whether tests cover the change adequately

Be direct and concise. Focus on semantic meaning, not line-by-line description.
Format your response as markdown.`;

async function explainChunk(chunk: string): Promise<string> {
	const prompt = `${SYSTEM_PROMPT}\n\nHere is the diff to analyze:\n\n${chunk}`;
	return callGemini(prompt);
}

// ── Structured Summary (no-AI mode) ─────────────────────────────────────────

function buildStructuredSummary(
	modules: ModuleChanges[],
	base: string,
	head: string,
): string {
	const lines: string[] = [];

	lines.push("# Diff Summary");
	lines.push("");
	lines.push(`> \`${base}...${head}\``);
	lines.push("");

	// Overview stats
	const totalFiles = modules.reduce((s, m) => s + m.files.length, 0);
	const totalAdd = modules.reduce((s, m) => s + m.totalAdditions, 0);
	const totalDel = modules.reduce((s, m) => s + m.totalDeletions, 0);
	lines.push(
		`**${totalFiles} files changed** | +${totalAdd} additions | -${totalDel} deletions`,
	);
	lines.push("");

	// Per-module breakdown
	lines.push("## Changes by Module");
	lines.push("");

	for (const mod of modules) {
		lines.push(
			`### ${mod.module} (+${mod.totalAdditions} -${mod.totalDeletions})`,
		);
		lines.push("");
		lines.push("| File | Change | +/- |");
		lines.push("|------|--------|-----|");
		for (const f of mod.files) {
			lines.push(`| ${f.path} | ${f.kind} | +${f.additions} -${f.deletions} |`);
		}
		lines.push("");
	}

	return lines.join("\n");
}

// ── AI-Enhanced Report ──────────────────────────────────────────────────────

async function buildAiReport(
	modules: ModuleChanges[],
	base: string,
	head: string,
): Promise<string> {
	const chunks = chunkModuleDiffs(modules);
	const explanations: string[] = [];

	for (const chunk of chunks) {
		const explanation = await explainChunk(chunk);
		explanations.push(explanation);
	}

	const lines: string[] = [];

	lines.push("# Semantic Diff Report");
	lines.push("");
	lines.push(
		`> Generated: ${new Date().toISOString().split("T")[0]} | Comparing \`${base}...${head}\``,
	);
	lines.push("");

	// Overview stats
	const totalFiles = modules.reduce((s, m) => s + m.files.length, 0);
	const totalAdd = modules.reduce((s, m) => s + m.totalAdditions, 0);
	const totalDel = modules.reduce((s, m) => s + m.totalDeletions, 0);
	lines.push(
		`**${totalFiles} files changed** | +${totalAdd} additions | -${totalDel} deletions`,
	);
	lines.push("");

	// AI explanations
	lines.push("## Semantic Analysis");
	lines.push("");
	for (const explanation of explanations) {
		lines.push(explanation);
		lines.push("");
		lines.push("---");
		lines.push("");
	}

	// File listing
	lines.push("## Files Changed");
	lines.push("");
	lines.push("| File | Change | +/- |");
	lines.push("|------|--------|-----|");
	for (const mod of modules) {
		for (const f of mod.files) {
			lines.push(`| ${f.path} | ${f.kind} | +${f.additions} -${f.deletions} |`);
		}
	}
	lines.push("");

	return lines.join("\n");
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
	const config = parseArgs();

	const fileDiffs = await getFileDiffs(config.base, config.head);

	if (fileDiffs.length === 0) {
		console.log(`No differences found between ${config.base} and ${config.head}.`);
		return;
	}

	const modules = groupByModule(fileDiffs);

	if (config.noAi || !process.env.GOOGLE_API_KEY) {
		if (!config.noAi && !process.env.GOOGLE_API_KEY) {
			console.error(
				"Warning: GOOGLE_API_KEY not set, falling back to structured summary.\n",
			);
		}
		const report = buildStructuredSummary(modules, config.base, config.head);
		console.log(report);
		return;
	}

	const report = await buildAiReport(modules, config.base, config.head);
	console.log(report);
}

main().catch((err) => {
	console.error("Failed to run semantic diff analysis:", err);
	process.exit(1);
});
