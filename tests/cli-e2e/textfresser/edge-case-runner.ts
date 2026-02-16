/**
 * Exploratory edge-case runner for Textfresser Lemma+Generate pipeline.
 *
 * Runs REAL API calls (no stubs) against cli-e2e-test-vault.
 * Usage: CLI_E2E_VAULT=cli-e2e-test-vault CLI_E2E_VAULT_PATH=/Users/annagorelova/work/obsidian/cli-e2e-test-vault bun run tests/cli-e2e/textfresser/edge-case-runner.ts
 */

import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
	createFile,
	deleteAllUnder,
	deletePath,
	fileExists,
	listFiles,
	readFile,
	reloadPlugin,
	waitForIdle,
} from "../utils";
import { obsidianEval } from "../utils/cli";

// ─── Test Definitions ───────────────────────────────────────────────

interface TestCase {
	id: string;
	group: string;
	filePath: string;
	content: string;
	surface: string;
	description: string;
}

const TEST_RUNS_ROOT = "textfresser/test-runs";

const TEST_CASES: TestCase[] = [
	// ── H1: Homonym Nouns ──
	{
		content: "Das alte Schloss thront über der Stadt. ^h1a",
		description: "New noun entry, castle sense",
		filePath: `${TEST_RUNS_ROOT}/H1/H1-A-schloss-castle.md`,
		group: "H1",
		id: "H1-A",
		surface: "Schloss",
	},
	{
		content: "Er steckte den Schlüssel ins Schloss. ^h1b",
		description: "Disambiguation: same lemma+POS, DIFFERENT sense → new entry or matched?",
		filePath: `${TEST_RUNS_ROOT}/H1/H1-B-schloss-lock.md`,
		group: "H1",
		id: "H1-B",
		surface: "Schloss",
	},
	{
		content: "Im Schloss gab es hundert Zimmer. ^h1c",
		description: "Re-encounter: should match castle sense from H1-A",
		filePath: `${TEST_RUNS_ROOT}/H1/H1-C-schloss-reencounter.md`,
		group: "H1",
		id: "H1-C",
		surface: "Schloss",
	},
	{
		content: "Die Bank am Fluss war nass vom Regen. ^h1d",
		description: "New noun, bench sense",
		filePath: `${TEST_RUNS_ROOT}/H1/H1-D-bank-bench.md`,
		group: "H1",
		id: "H1-D",
		surface: "Bank",
	},
	{
		content: "Sie hebt Geld bei der Bank ab. ^h1e",
		description: "Disambiguation: same lemma, different sense (die Bank)",
		filePath: `${TEST_RUNS_ROOT}/H1/H1-E-bank-finance.md`,
		group: "H1",
		id: "H1-E",
		surface: "Bank",
	},
	// ── H2: Cross-POS ──
	{
		content: "Das Essen im Restaurant war ausgezeichnet. ^h2a",
		description: "Noun (das Essen = food/meal)",
		filePath: `${TEST_RUNS_ROOT}/H2/H2-A-essen-noun.md`,
		group: "H2",
		id: "H2-A",
		surface: "Essen",
	},
	{
		content: "Wir essen heute Abend zusammen. ^h2b",
		description: "Verb (essen = to eat). Same lemma, different POS → separate entry",
		filePath: `${TEST_RUNS_ROOT}/H2/H2-B-essen-verb.md`,
		group: "H2",
		id: "H2-B",
		surface: "essen",
	},
	{
		content: "Die Fliegen im Sommer sind lästig. ^h2c",
		description: "Noun plural (die Fliege). Lemma should resolve to Fliege",
		filePath: `${TEST_RUNS_ROOT}/H2/H2-C-fliege-noun.md`,
		group: "H2",
		id: "H2-C",
		surface: "Fliegen",
	},
	{
		content: "Wir fliegen morgen nach Berlin. ^h2d",
		description: "Verb (fliegen = to fly). Different lemma from Fliege",
		filePath: `${TEST_RUNS_ROOT}/H2/H2-D-fliegen-verb.md`,
		group: "H2",
		id: "H2-D",
		surface: "fliegen",
	},
	{
		content: "Der Lauf des Flusses war ruhig. ^h2e",
		description: "Noun (der Lauf = course/run)",
		filePath: `${TEST_RUNS_ROOT}/H2/H2-E-lauf-noun.md`,
		group: "H2",
		id: "H2-E",
		surface: "Lauf",
	},
	{
		content: "Die Kinder laufen schnell im Park. ^h2f",
		description: "Verb. Lemma laufen ≠ noun Lauf? Or same?",
		filePath: `${TEST_RUNS_ROOT}/H2/H2-F-laufen-verb.md`,
		group: "H2",
		id: "H2-F",
		surface: "laufen",
	},
	// ── V1: Separable Verbs ──
	{
		content: "Er macht die Tür auf. ^v1a",
		description: 'Should detect "aufmachen" separable verb',
		filePath: `${TEST_RUNS_ROOT}/V1/V1-A-aufmachen.md`,
		group: "V1",
		id: "V1-A",
		surface: "macht",
	},
	{
		content: "Wann fängst du damit an? ^v1b",
		description: '"anfangen", inflected stem + detached prefix',
		filePath: `${TEST_RUNS_ROOT}/V1/V1-B-anfangen.md`,
		group: "V1",
		id: "V1-B",
		surface: "fängst",
	},
	{
		content: "Sie kauft im Supermarkt ein. ^v1c",
		description: '"einkaufen"',
		filePath: `${TEST_RUNS_ROOT}/V1/V1-C-einkaufen.md`,
		group: "V1",
		id: "V1-C",
		surface: "kauft",
	},
	{
		content: "Pass bitte auf die Kinder auf! ^v1d",
		description: '"aufpassen" imperative — TWO "auf" in sentence!',
		filePath: `${TEST_RUNS_ROOT}/V1/V1-D-aufpassen.md`,
		group: "V1",
		id: "V1-D",
		surface: "Pass",
	},
	{
		content: "Er gibt das Buch morgen zurück. ^v1e",
		description: '"zurückgeben"',
		filePath: `${TEST_RUNS_ROOT}/V1/V1-E-zurueckgeben.md`,
		group: "V1",
		id: "V1-E",
		surface: "gibt",
	},
	{
		content: "Sie hört mit dem Rauchen auf. ^v1f",
		description: '"aufhören"',
		filePath: `${TEST_RUNS_ROOT}/V1/V1-F-aufhoeren.md`,
		group: "V1",
		id: "V1-F",
		surface: "hört",
	},
	// ── PH1: Phrasems ──
	{
		content: "Auf keinen Fall mache ich das. ^ph1a",
		description: "Phrasem detection, multi-word selection",
		filePath: `${TEST_RUNS_ROOT}/PH1/PH1-A-auf-keinen-fall.md`,
		group: "PH1",
		id: "PH1-A",
		surface: "Auf keinen Fall",
	},
	{
		content: "Sie verließ Hals über Kopf das Haus. ^ph1b",
		description: "Idiom phrasem",
		filePath: `${TEST_RUNS_ROOT}/PH1/PH1-B-hals-ueber-kopf.md`,
		group: "PH1",
		id: "PH1-B",
		surface: "Hals über Kopf",
	},
	{
		content: "Alles ist in Ordnung. ^ph1c",
		description: "Common phrase",
		filePath: `${TEST_RUNS_ROOT}/PH1/PH1-C-in-ordnung.md`,
		group: "PH1",
		id: "PH1-C",
		surface: "in Ordnung",
	},
	{
		content: "Er hat ins Schwarze getroffen. ^ph1d",
		description: "Idiom with inflected article",
		filePath: `${TEST_RUNS_ROOT}/PH1/PH1-D-schwarze-treffen.md`,
		group: "PH1",
		id: "PH1-D",
		surface: "ins Schwarze getroffen",
	},
	// ── ADJ1: Adjective Forms ──
	{
		content: "Das Wetter ist heute schön. ^adj1a",
		description: "Adjective base form, new entry",
		filePath: `${TEST_RUNS_ROOT}/ADJ1/ADJ1-A-schoen-base.md`,
		group: "ADJ1",
		id: "ADJ1-A",
		surface: "schön",
	},
	{
		content: "Morgen wird es noch schöner. ^adj1b",
		description: 'Comparative → lemma "schön", re-encounter or inflection propagation?',
		filePath: `${TEST_RUNS_ROOT}/ADJ1/ADJ1-B-schoener-comp.md`,
		group: "ADJ1",
		id: "ADJ1-B",
		surface: "schöner",
	},
	{
		content: "Der klügste Schüler hat gewonnen. ^adj1c",
		description: 'Superlative → lemma "klug"',
		filePath: `${TEST_RUNS_ROOT}/ADJ1/ADJ1-C-klug-super.md`,
		group: "ADJ1",
		id: "ADJ1-C",
		surface: "klügste",
	},
	{
		content: "Sie ist klüger als ihr Bruder. ^adj1d",
		description: "Comparative → re-encounter with klug from ADJ1-C",
		filePath: `${TEST_RUNS_ROOT}/ADJ1/ADJ1-D-klug-comp.md`,
		group: "ADJ1",
		id: "ADJ1-D",
		surface: "klüger",
	},
];

// ─── Helpers ────────────────────────────────────────────────────────

function escapeForJs(value: string): string {
	return value
		.replace(/\\/g, "\\\\")
		.replace(/'/g, "\\'")
		.replace(/\n/g, "\\n")
		.replace(/\r/g, "\\r");
}

async function runLemmaOnFile(
	filePath: string,
	surface: string,
): Promise<{ ok: boolean; error?: string }> {
	const surfaceEscaped = escapeForJs(surface);
	const pathEscaped = escapeForJs(filePath);

	const code = `(async()=>{const plugin=app.plugins.plugins['cbcr-text-eater-de'];if(!plugin||!plugin.textfresser){throw new Error('Textfresser plugin not available')}const toSplitPath=(path)=>{const parts=path.split('/');const fileName=parts.pop();if(!fileName){throw new Error('Invalid file path: '+path)}const dot=fileName.lastIndexOf('.');if(dot===-1){throw new Error('File without extension: '+fileName)}return {basename:fileName.slice(0,dot),extension:fileName.slice(dot+1),kind:'MdFile',pathParts:parts}};const splitPath=toSplitPath('${pathEscaped}');const file=app.vault.getAbstractFileByPath('${pathEscaped}');if(!file){throw new Error('File not found: ${pathEscaped}')}const content=await app.vault.read(file);const surface='${surfaceEscaped}';const start=content.indexOf(surface);if(start===-1){throw new Error('Selected text not found: '+surface)}const lines=content.split('\\n');let lineStart=0;let surroundingRawBlock=null;for(const line of lines){const lineEnd=lineStart+line.length;if(start>=lineStart&&start<=lineEnd){surroundingRawBlock=line;break}lineStart=lineEnd+1}if(surroundingRawBlock===null){throw new Error('Could not resolve surrounding block')}const result=await plugin.textfresser.executeCommand('Lemma',{activeFile:{content,splitPath},selection:{selectionStartInBlock:start-lineStart,splitPathToFileWithSelection:splitPath,surroundingRawBlock,text:surface}},()=>{});if(result.isErr&&result.isErr()){const error=result.error;const reason=error&&typeof error==='object'&&'reason' in error?error.reason:'';return 'ERROR:'+String(error.kind||'unknown')+':'+(reason?String(reason):'')}return 'ok'})()`;

	try {
		const result = await obsidianEval(code, 30_000);
		if (result.startsWith("ERROR:")) {
			return { error: result, ok: false };
		}
		return { ok: true };
	} catch (e) {
		return { error: e instanceof Error ? e.message : String(e), ok: false };
	}
}

interface TestResult {
	testCase: TestCase;
	lemmaOk: boolean;
	lemmaError?: string;
	sourceAfter: string;
	wikilinkFound: boolean;
	wikilinkTarget: string | null;
	entryPath: string | null;
	entryContent: string | null;
	worterFiles: string[];
}

const WIKILINK_REGEX = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;

function findWikilinkTarget(content: string, surface: string): string | null {
	for (const match of content.matchAll(WIKILINK_REGEX)) {
		const target = match[1];
		const alias = match[2];
		if (!target) continue;
		if (alias === surface || (alias === undefined && target === surface)) {
			return target;
		}
	}
	return null;
}

function hasNestedWikilinks(content: string): boolean {
	return /\[\[[^\]]*\[\[/.test(content);
}

async function resolveEntryPath(linkTarget: string): Promise<string | null> {
	const candidate = linkTarget.endsWith(".md") ? linkTarget : `${linkTarget}.md`;
	if (await fileExists(candidate)) return candidate;

	const basename = candidate.split("/").pop();
	if (!basename) return null;

	const allFiles = await listFiles("Worter", "md");
	const matches = allFiles.filter(
		(p) => p.endsWith(`/${basename}`) || p === basename,
	);
	if (matches.length === 1) return matches[0] ?? null;
	if (matches.length > 1) return matches[0] ?? null; // take first, note ambiguity
	return null;
}

// ─── Main ───────────────────────────────────────────────────────────

async function main(): Promise<void> {
	console.log("=== Textfresser Edge Case Runner ===\n");

	// Step 0: Clean slate
	console.log("Step 0: Cleaning vault...");
	await deleteAllUnder("Worter/de");
	await deleteAllUnder("Library/de");
	await deleteAllUnder(`${TEST_RUNS_ROOT}/H1`);
	await deleteAllUnder(`${TEST_RUNS_ROOT}/H2`);
	await deleteAllUnder(`${TEST_RUNS_ROOT}/V1`);
	await deleteAllUnder(`${TEST_RUNS_ROOT}/PH1`);
	await deleteAllUnder(`${TEST_RUNS_ROOT}/ADJ1`);
	await deletePath(`${TEST_RUNS_ROOT}/A1/A1-A.md`);
	await deletePath(`${TEST_RUNS_ROOT}/A1/A1-B.md`);

	await reloadPlugin();
	await waitForIdle(10_000);
	console.log("  Vault cleaned.\n");

	// Step 1: Create all test files
	console.log("Step 1: Creating test files...");
	for (const tc of TEST_CASES) {
		await createFile(tc.filePath, tc.content);
		console.log(`  Created: ${tc.filePath}`);
	}
	await waitForIdle(5_000);
	console.log("  All test files created.\n");

	// Step 2: Execute Lemma for each test case
	const results: TestResult[] = [];

	// Group test cases by group to run in order
	const groups = ["H1", "H2", "V1", "PH1", "ADJ1"];

	for (const group of groups) {
		const groupCases = TEST_CASES.filter((tc) => tc.group === group);
		console.log(`\n── Group ${group} (${groupCases.length} cases) ──`);

		for (const tc of groupCases) {
			console.log(`\n  [${tc.id}] Running Lemma for "${tc.surface}" in ${tc.filePath}`);
			console.log(`  Description: ${tc.description}`);

			// Run lemma
			const lemmaResult = await runLemmaOnFile(tc.filePath, tc.surface);
			console.log(`  Lemma result: ${lemmaResult.ok ? "OK" : `FAILED: ${lemmaResult.error}`}`);

			// Wait for background generate
			console.log("  Waiting for idle (background generate)...");
			try {
				await waitForIdle(180_000);
			} catch {
				console.log("  WARNING: waitForIdle timed out");
			}

			// Read source file after
			let sourceAfter = "";
			try {
				sourceAfter = await readFile(tc.filePath);
			} catch {
				sourceAfter = "[COULD NOT READ]";
			}

			// Find wikilink
			const wikilinkTarget = findWikilinkTarget(sourceAfter, tc.surface);
			const wikilinkFound = wikilinkTarget !== null;
			const nested = hasNestedWikilinks(sourceAfter);

			console.log(`  Source after: ${sourceAfter.trim().substring(0, 120)}${sourceAfter.length > 120 ? "..." : ""}`);
			console.log(`  Wikilink found: ${wikilinkFound}${wikilinkTarget ? ` → ${wikilinkTarget}` : ""}`);
			if (nested) console.log("  ⚠️  NESTED WIKILINKS DETECTED");

			// Resolve entry
			let entryPath: string | null = null;
			let entryContent: string | null = null;
			if (wikilinkTarget) {
				entryPath = await resolveEntryPath(wikilinkTarget);
				if (entryPath) {
					try {
						entryContent = await readFile(entryPath);
					} catch {
						entryContent = "[COULD NOT READ]";
					}
					console.log(`  Entry path: ${entryPath}`);
					console.log(`  Entry content (first 200 chars): ${entryContent?.substring(0, 200)}`);
				} else {
					console.log(`  Entry path: NOT FOUND for target "${wikilinkTarget}"`);
				}
			}

			// List all Worter files after this step
			let worterFiles: string[] = [];
			try {
				worterFiles = await listFiles("Worter", "md");
			} catch {
				// ignore
			}

			results.push({
				entryContent,
				entryPath,
				lemmaError: lemmaResult.error,
				lemmaOk: lemmaResult.ok,
				sourceAfter,
				testCase: tc,
				wikilinkFound,
				wikilinkTarget,
				worterFiles,
			});
		}
	}

	// Step 3: Generate report
	console.log("\n\n=== GENERATING REPORT ===\n");

	const report = generateReport(results);

	// Write to local file (not vault) for easy access
	const reportPath = resolve(import.meta.dir, "edge-case-results.md");
	writeFileSync(reportPath, report, "utf-8");
	console.log(`Report written to: ${reportPath}`);

	// Also write to vault
	try {
		await createFile(`${TEST_RUNS_ROOT}/book-of-work.md`, report);
		console.log(`Report also written to vault: ${TEST_RUNS_ROOT}/book-of-work.md`);
	} catch (e) {
		console.log(`Could not write to vault: ${e}`);
	}

	console.log("\n=== DONE ===");
}

function generateReport(results: TestResult[]): string {
	const now = new Date().toISOString().split("T")[0];
	const groups = ["H1", "H2", "V1", "PH1", "ADJ1"];

	const groupNames: Record<string, string> = {
		ADJ1: "Adjective Forms & Propagation",
		H1: "Homonym Nouns",
		H2: "Cross-POS",
		PH1: "Phrasems / Multi-Word Expressions",
		V1: "Separable Verbs",
	};

	let md = `# Textfresser Edge Case Testing — Book of Work\n\n`;
	md += `## Test Environment\n`;
	md += `- **Date**: ${now}\n`;
	md += `- **Vault**: cli-e2e-test-vault\n`;
	md += `- **Branch**: mb_restructure\n`;
	md += `- **Mode**: Real API (no stubs)\n\n`;

	// Summary table
	md += `## Summary\n\n`;
	md += `| ID | Surface | Lemma OK | Wikilink | Entry Found | Notes |\n`;
	md += `|---|---|---|---|---|---|\n`;
	for (const r of results) {
		const nested = hasNestedWikilinks(r.sourceAfter) ? " ⚠️ NESTED" : "";
		md += `| ${r.testCase.id} | ${r.testCase.surface} | ${r.lemmaOk ? "✅" : "❌"} | ${r.wikilinkFound ? "✅" : "❌"} | ${r.entryPath ? "✅" : "❌"} | ${r.lemmaError ?? ""}${nested} |\n`;
	}
	md += "\n";

	// Detailed findings by group
	md += `## Findings by Category\n\n`;
	for (const group of groups) {
		const groupResults = results.filter((r) => r.testCase.group === group);
		md += `### ${group}: ${groupNames[group] ?? group}\n\n`;

		for (const r of groupResults) {
			md += `#### ${r.testCase.id}: "${r.testCase.surface}" — ${r.testCase.description}\n\n`;
			md += `**Lemma**: ${r.lemmaOk ? "OK" : `FAILED: ${r.lemmaError}`}\n\n`;
			md += `**Source after**:\n\`\`\`\n${r.sourceAfter.trim()}\n\`\`\`\n\n`;

			if (r.wikilinkTarget) {
				md += `**Wikilink target**: \`${r.wikilinkTarget}\`\n\n`;
			} else {
				md += `**Wikilink**: NOT FOUND in source\n\n`;
			}

			if (r.entryPath && r.entryContent) {
				md += `**Entry path**: \`${r.entryPath}\`\n\n`;
				md += `**Entry content**:\n\`\`\`markdown\n${r.entryContent.trim()}\n\`\`\`\n\n`;
			} else if (r.wikilinkTarget) {
				md += `**Entry**: NOT FOUND at any path for target "${r.wikilinkTarget}"\n\n`;
			}

			// Check for anomalies
			const anomalies: string[] = [];
			if (hasNestedWikilinks(r.sourceAfter)) anomalies.push("Nested wikilinks detected");
			if (r.lemmaOk && !r.wikilinkFound) anomalies.push("Lemma succeeded but no wikilink in source");
			if (r.wikilinkFound && !r.entryPath) anomalies.push("Wikilink exists but entry file not found");
			if (anomalies.length > 0) {
				md += `**Anomalies**:\n${anomalies.map((a) => `- ⚠️ ${a}`).join("\n")}\n\n`;
			}

			md += "---\n\n";
		}
	}

	// Worter tree at end
	const lastResult = results[results.length - 1];
	if (lastResult) {
		md += `## Final Worter Tree\n\n`;
		md += `\`\`\`\n${lastResult.worterFiles.join("\n")}\n\`\`\`\n\n`;
	}

	// Placeholder for improvements
	md += `## Proposed Improvements\n\n`;
	md += `_To be filled after analysis of results above._\n\n`;
	md += `## Priority Ranking\n\n`;
	md += `| # | Improvement | Impact | Effort | Priority |\n`;
	md += `|---|---|---|---|---|\n`;
	md += `| | | | | |\n`;

	return md;
}

main().catch((e) => {
	console.error("FATAL:", e);
	process.exit(1);
});
