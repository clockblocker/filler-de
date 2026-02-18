/**
 * Post-migration smoke test: Lemma/Generate on 5 attestation sentences.
 *
 * Usage:
 *   CLI_E2E_VAULT=cli-e2e-test-vault CLI_E2E_VAULT_PATH=/Users/annagorelova/work/obsidian/cli-e2e-test-vault \
 *     bun run tests/cli-e2e/textfresser/smoke-test-runner.ts
 *
 * Uses real Gemini API (no stubs). Requires Obsidian running with the test vault open.
 */

import {
	createFile,
	deletePath,
	listFiles,
	readFile,
} from "../utils";
import { obsidianEval } from "../utils/cli";
import { waitForIdle } from "../utils/idle";

const SOURCE_PATH = "Outside/Migration-Smoke-Test.md";

const SOURCE_CONTENT = [
	"Der Fahrer fährt mit der Fahrkarte zur Abfahrt. ^0",
	"",
	"Sie unterschreibt das Formular, und ihre Unterschrift steht schon unten. ^1",
	"",
	"Die Bauarbeiter bauen heute einen Neubau am Stadtrand. ^2",
	"",
	"Ich stelle mich kurz vor, und meine Vorstellung ist sehr knapp. ^3",
	"",
	"Wir arbeiten im Team, und die Zusammenarbeit verbessert unsere Arbeit. ^4",
].join("\n");

interface TestWord {
	surface: string;
	sentenceIndex: number;
	expectedLemma?: string;
	pattern: string;
}

const TEST_WORDS: TestWord[] = [
	{ expectedLemma: "Fahrer", pattern: "Derivation from fahren", sentenceIndex: 0, surface: "Fahrer" },
	{ expectedLemma: "Abfahrt", pattern: "Compound/prefix derivation", sentenceIndex: 0, surface: "Abfahrt" },
	{ expectedLemma: "Unterschrift", pattern: "Noun from unterschreiben", sentenceIndex: 1, surface: "Unterschrift" },
	{ expectedLemma: "unterschreiben", pattern: "Verb conjugated", sentenceIndex: 1, surface: "unterschreibt" },
	{ expectedLemma: "Bauarbeiter", pattern: "Compound word", sentenceIndex: 2, surface: "Bauarbeiter" },
	{ expectedLemma: "Neubau", pattern: "Compound (Neu+Bau)", sentenceIndex: 2, surface: "Neubau" },
	{ expectedLemma: "Vorstellung", pattern: "Sep verb derivation", sentenceIndex: 3, surface: "Vorstellung" },
	{ expectedLemma: "Zusammenarbeit", pattern: "Compound", sentenceIndex: 4, surface: "Zusammenarbeit" },
	{ expectedLemma: "Arbeit", pattern: "Root noun", sentenceIndex: 4, surface: "Arbeit" },
];

interface WordResult {
	surface: string;
	sentenceIndex: number;
	expectedLemma?: string;
	pattern: string;
	lemmaOk: boolean;
	resolvedLemma: string | null;
	pos: string | null;
	linguisticUnit: string | null;
	wikilinkInserted: boolean;
	nestedWikilinks: boolean;
	entryCreated: boolean;
	entryPath: string | null;
	errors: string[];
}

const WIKILINK_REGEX = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;

function escapeForJs(value: string): string {
	return value
		.replace(/\\/g, "\\\\")
		.replace(/'/g, "\\'")
		.replace(/\n/g, "\\n")
		.replace(/\r/g, "\\r");
}

async function runLemmaOnFile(surface: string, filePath: string): Promise<void> {
	const surfaceEscaped = escapeForJs(surface);
	const pathEscaped = escapeForJs(filePath);

	const code = `(async()=>{const plugin=app.plugins.plugins['cbcr-text-eater-de'];if(!plugin||!plugin.textfresser){throw new Error('Textfresser plugin not available')}const toSplitPath=(path)=>{const parts=path.split('/');const fileName=parts.pop();if(!fileName){throw new Error('Invalid file path: '+path)}const dot=fileName.lastIndexOf('.');if(dot===-1){throw new Error('File without extension: '+fileName)}return {basename:fileName.slice(0,dot),extension:fileName.slice(dot+1),kind:'MdFile',pathParts:parts}};const splitPath=toSplitPath('${pathEscaped}');const file=app.vault.getAbstractFileByPath('${pathEscaped}');if(!file){throw new Error('File not found: ${pathEscaped}')}const content=await app.vault.read(file);const surface='${surfaceEscaped}';const start=content.indexOf(surface);if(start===-1){throw new Error('Selected text not found: '+surface)}const lines=content.split('\\n');let lineStart=0;let surroundingRawBlock=null;for(const line of lines){const lineEnd=lineStart+line.length;if(start>=lineStart&&start<=lineEnd){surroundingRawBlock=line;break}lineStart=lineEnd+1}if(surroundingRawBlock===null){throw new Error('Could not resolve surrounding block')}const result=await plugin.textfresser.executeCommand('Lemma',{activeFile:{content,splitPath},selection:{selectionStartInBlock:start-lineStart,splitPathToFileWithSelection:splitPath,surroundingRawBlock,text:surface}},()=>{});if(result.isErr&&result.isErr()){const error=result.error;const reason=error&&typeof error==='object'&&'reason' in error?error.reason:'';throw new Error('Lemma failed: '+String(error.kind??'unknown')+(reason?': '+String(reason):''))}return 'ok'})()`;

	await obsidianEval(code, 30_000);
}

async function getLemmaState(): Promise<{ lemma: string; pos: string; linguisticUnit: string } | null> {
	try {
		const result = await obsidianEval(
			`(async()=>{const plugin=app.plugins.plugins['cbcr-text-eater-de'];const state=plugin.textfresser.getState();const lr=state.latestLemmaResult;if(!lr)return JSON.stringify(null);return JSON.stringify({lemma:lr.lemma,pos:lr.posLikeKind,linguisticUnit:lr.linguisticUnit})})()`,
			10_000,
		);
		return JSON.parse(result);
	} catch {
		return null;
	}
}

function findWikilinkForSurface(content: string, surface: string): string | null {
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

async function findNewEntries(beforeFiles: string[]): Promise<string[]> {
	const afterFiles = await listFiles("Worter/de", "md");
	return afterFiles.filter((f) => !beforeFiles.includes(f));
}

async function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
	console.log("=== Post-Migration Smoke Test ===\n");

	// 1. Setup: create source file
	console.log("[setup] Deleting old source file...");
	await deletePath(SOURCE_PATH);
	await sleep(500);

	console.log("[setup] Creating source file...");
	await createFile(SOURCE_PATH, SOURCE_CONTENT);
	await sleep(500);

	// Verify file was created
	const initialContent = await readFile(SOURCE_PATH);
	console.log("[setup] Source file created. Lines:", initialContent.split("\n").length);
	console.log("[setup] Content preview:", initialContent.slice(0, 100), "...\n");

	// 2. Snapshot existing entries
	const existingEntries = await listFiles("Worter/de", "md");
	console.log(`[setup] Existing entries in Worter/de: ${existingEntries.length}\n`);

	// 3. Run each test word
	const results: WordResult[] = [];

	for (let i = 0; i < TEST_WORDS.length; i++) {
		const word = TEST_WORDS[i];
		if (!word) continue;

		console.log(`\n--- [${i + 1}/${TEST_WORDS.length}] Testing "${word.surface}" (sentence ^${word.sentenceIndex}) ---`);
		console.log(`    Pattern: ${word.pattern}`);

		const result: WordResult = {
			entryCreated: false,
			entryPath: null,
			errors: [],
			expectedLemma: word.expectedLemma,
			lemmaOk: false,
			linguisticUnit: null,
			nestedWikilinks: false,
			pattern: word.pattern,
			pos: null,
			resolvedLemma: null,
			sentenceIndex: word.sentenceIndex,
			surface: word.surface,
			wikilinkInserted: false,
		};

		// Snapshot entries before this word
		const entriesBefore = await listFiles("Worter/de", "md");

		try {
			// Run lemma
			console.log(`    Running lemma for "${word.surface}"...`);
			await runLemmaOnFile(word.surface, SOURCE_PATH);
			result.lemmaOk = true;
			console.log(`    Lemma command succeeded.`);

			// Read lemma state
			const state = await getLemmaState();
			if (state) {
				result.resolvedLemma = state.lemma;
				result.pos = state.pos;
				result.linguisticUnit = state.linguisticUnit;
				console.log(`    Lemma resolved: "${state.lemma}" (${state.pos}, ${state.linguisticUnit})`);
			} else {
				result.errors.push("Could not read lemma state");
				console.log(`    ⚠ Could not read lemma state`);
			}

			// Wait for background generate (real API — give it time)
			console.log(`    Waiting for background generate (up to 120s)...`);
			try {
				await waitForIdle(120_000);
				console.log(`    Plugin idle.`);
			} catch (e) {
				const msg = e instanceof Error ? e.message : String(e);
				result.errors.push(`Idle timeout: ${msg}`);
				console.log(`    ⚠ Idle timeout: ${msg}`);
			}

			// Small extra wait for file system
			await sleep(1000);

			// Check source file for wikilink
			const currentContent = await readFile(SOURCE_PATH);
			const wikilinkTarget = findWikilinkForSurface(currentContent, word.surface);
			result.wikilinkInserted = wikilinkTarget !== null;
			result.nestedWikilinks = hasNestedWikilinks(currentContent);

			if (wikilinkTarget) {
				console.log(`    Wikilink inserted: [[${wikilinkTarget}|${word.surface}]]`);
			} else {
				console.log(`    ⚠ No wikilink found for "${word.surface}"`);
			}

			if (result.nestedWikilinks) {
				result.errors.push("Nested wikilinks detected in source file");
				console.log(`    ⚠ NESTED WIKILINKS detected!`);
			}

			// Check for new entry
			const newEntries = await findNewEntries(entriesBefore);
			if (newEntries.length > 0) {
				result.entryCreated = true;
				result.entryPath = newEntries[0] ?? null;
				console.log(`    Entry created: ${newEntries.join(", ")}`);

				// Read entry content for verification
				if (result.entryPath) {
					try {
						const entryContent = await readFile(result.entryPath);
						const lines = entryContent.split("\n").length;
						console.log(`    Entry has ${lines} lines`);
					} catch (e) {
						console.log(`    Could not read entry: ${e instanceof Error ? e.message : String(e)}`);
					}
				}
			} else {
				console.log(`    ⚠ No new entry detected`);
			}
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e);
			result.errors.push(`Exception: ${msg}`);
			console.log(`    ✗ ERROR: ${msg}`);
		}

		results.push(result);

		// Small delay between words
		await sleep(500);
	}

	// 4. Final source file state
	console.log("\n\n=== Final Source File ===");
	const finalContent = await readFile(SOURCE_PATH);
	console.log(finalContent);

	// 5. Summary
	console.log("\n\n=== RESULTS SUMMARY ===\n");
	console.log(
		"| # | Surface | Lemma OK | Resolved | POS | Unit | Wikilink | Entry | Errors |",
	);
	console.log(
		"|---|---------|----------|----------|-----|------|----------|-------|--------|",
	);

	for (const r of results) {
		const lemmaOk = r.lemmaOk ? "Y" : "N";
		const resolved = r.resolvedLemma ?? "-";
		const pos = r.pos ?? "-";
		const unit = r.linguisticUnit ?? "-";
		const wikilink = r.wikilinkInserted ? "Y" : "N";
		const entry = r.entryCreated ? "Y" : "N";
		const errors = r.errors.length > 0 ? r.errors.join("; ") : "-";
		console.log(
			`| ${r.sentenceIndex} | ${r.surface} | ${lemmaOk} | ${resolved} | ${pos} | ${unit} | ${wikilink} | ${entry} | ${errors} |`,
		);
	}

	// 6. All entries
	console.log("\n\n=== All Entries After Test ===");
	const allEntries = await listFiles("Worter/de", "md");
	const newEntries = allEntries.filter((f) => !existingEntries.includes(f));
	console.log(`New entries created: ${newEntries.length}`);
	for (const e of newEntries) {
		console.log(`  - ${e}`);
	}

	// 7. Print entry contents for new entries
	console.log("\n\n=== New Entry Contents ===");
	for (const entryPath of newEntries) {
		console.log(`\n--- ${entryPath} ---`);
		try {
			const content = await readFile(entryPath);
			console.log(content);
		} catch (e) {
			console.log(`  (could not read: ${e instanceof Error ? e.message : String(e)})`);
		}
	}

	// 8. Dump full JSON results
	console.log("\n\n=== JSON Results ===");
	console.log(JSON.stringify(results, null, 2));
}

main().catch((e) => {
	console.error("FATAL:", e);
	process.exit(1);
});
