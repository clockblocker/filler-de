// wdio.conf.mts

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import * as path from "node:path";
import { join } from "node:path";
import { env } from "node:process";
import { fileURLToPath } from "node:url";
import { parseObsidianVersions } from "wdio-obsidian-service";

// Inline logToFile to avoid WebdriverIO module resolution issues
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LOG_DIR = join(__dirname, "tests/tracing/logs");
const logToFile = (fileName: string, content: string) => {
	if (!existsSync(LOG_DIR)) {
		mkdirSync(LOG_DIR, { recursive: true });
	}
	writeFileSync(join(LOG_DIR, fileName), content, "utf-8");
};

/**
 * Filter noisy WDIO output from stdout/stderr and write it to a file.
 * Keeps console minimal (suite tree + Spec Files).
 */
function installStdIoNoiseFilter(opts: { logFile: string; deny: RegExp[] }) {
	const origOut = process.stdout.write.bind(process.stdout);
	const origErr = process.stderr.write.bind(process.stderr);

	const buffer: string[] = [];
	const shouldDeny = (s: string) => opts.deny.some((re) => re.test(s));
	
	// State persists across chunks
	let inErrorBlock = false;
	let needNewlineAfterError = false;
	let lastWasReporterHeader = false;

	const handle = (chunk: any, origWrite: typeof process.stdout.write) => {
		const s =
			typeof chunk === "string"
				? chunk
				: chunk?.toString?.("utf8") ?? String(chunk);

		const lines = s.split(/\r?\n/);

		let passthrough = "";
		
		for (const line of lines) {
			// Add newline before "Spec Files:"
			if (/^Spec Files:\s/.test(line)) {
				passthrough += "\n";
			}
			
			// Check for reporter header (even if not denied, to add spacing)
			const isReporterHeader = /tldr-reporter\.cjs.*Reporter:\s*$/.test(line);
			
			if (shouldDeny(line)) {
				// Track if this starts an error block
				if (/^(E2ETestError|FilesExpectationError|FilesNotGoneError|TypeError|Error):/.test(line)) {
					inErrorBlock = true;
				} else if (/^\s+at\s/.test(line)) {
					// Stack trace - continue error block
					inErrorBlock = true;
				} else if (isReporterHeader) {
					// Reporter header comes after error block
					if (inErrorBlock) {
						inErrorBlock = false;
						needNewlineAfterError = true;
					}
					lastWasReporterHeader = true;
				}
				buffer.push(line);
			} else {
				// Check for error patterns even in non-denied lines (for spacing)
				if (/^(E2ETestError|FilesExpectationError|FilesNotGoneError|TypeError|Error):/.test(line)) {
					inErrorBlock = true;
				} else if (/^\s+at\s/.test(line) && inErrorBlock) {
					// Continue error block
				} else if (isReporterHeader) {
					// Reporter header
					if (inErrorBlock) {
						inErrorBlock = false;
						needNewlineAfterError = true;
					}
					lastWasReporterHeader = true;
				} else {
					// Add newline after error block ends
					if (inErrorBlock || needNewlineAfterError) {
						inErrorBlock = false;
						needNewlineAfterError = false;
						passthrough += "\n";
					}
					
					// Add newline after reporter header
					if (lastWasReporterHeader) {
						lastWasReporterHeader = false;
						passthrough += "\n";
					}
				}
				
				if (line.length === 0) {
					passthrough += "\n";
				} else {
					passthrough += line + "\n";
				}
			}
		}

		if (passthrough) origWrite(passthrough);
	};

	process.stdout.write = ((chunk: any) => {
		handle(chunk, origOut);
		return true;
	}) as any;

	process.stderr.write = ((chunk: any) => {
		handle(chunk, origErr);
		return true;
	}) as any;

	// synchronous flush at process exit
	process.on("exit", () => {
		if (buffer.length) {
			logToFile(opts.logFile, buffer.join("\n") + "\n");
		}
	});
}

// Helper: safe filename
const safeName = (s: string) =>
	s.replace(/[^\w.-]+/g, "_").replace(/_+/g, "_").slice(0, 200);

// Install noise filter early (before any WDIO output)
installStdIoNoiseFilter({
	deny: [
		// 1) All worker-prefixed noise (RUNNING/FAILED/Error in reporter/etc)
		/^\[\d+-\d+\]\s/,

		// 2) Unprefixed error blocks (WDIO/Mocha often prints these)
		/^E2ETestError:/,
		/^FilesExpectationError:/,
		/^FilesNotGoneError:/,
		/^TypeError:\s/,
		/^Error:\s/,
		/^\s+at\s/, // stack frames

		// 3) The "custom reporter header" printed by WDIO
		/".*tldr-reporter\.cjs".*Reporter:\s*$/,

		// 4) Misc launcher noise
		/^Bundled \d+ modules in \d+ms/,
		/^\s*main\.js\s+\d+/,
		/^error: script ".*" exited with code \d+/,

		// 5) Blank lines that originate from denied blocks
		/^\s*$/,
	],
	logFile: "wdio-noise-launcher.log",
});

// wdio-obsidian-service will download Obsidian versions into this directory
const cacheDir = path.resolve(".obsidian-cache");

// Store WDIO worker logs here (separate from your trace logs)
const outputDir = path.resolve(".wdio-logs");

// choose Obsidian versions to test (force stable; ignore env that may include beta)
const stableVersions = "latest/latest";
const desktopVersions = await parseObsidianVersions(stableVersions, { cacheDir });
const mobileVersions = await parseObsidianVersions(stableVersions, { cacheDir });

if (env.CI) {
	// used as workflow cache key
	console.log(
		"obsidian-cache-key:",
		JSON.stringify([desktopVersions, mobileVersions]),
	);
}

// Skip mobile emulation for faster local dev (set WDIO_MOBILE=1 to include)
const includeMobile = env.WDIO_MOBILE === "1" || env.CI;

export const config: WebdriverIO.Config = {

	/**
	 * Write full failure diagnostics to file. Console remains TL;DR.
	 * Your E2E errors should attach verbose info to `err.details`.
	 */
	afterTest: async function (test, _context, result) {
		const err = result.error as any;
		if (!err) return;

		const title = test.fullTitle ?? test.title ?? "unknown-test";
		const file = `fail_${safeName(title)}.log`;

		const body =
			(typeof err.details === "string" && err.details.trim().length > 0
				? `DETAILS:\n${err.details}\n\n`
				: "") +
			`MESSAGE:\n${String(err.message ?? "")}\n\n` +
			`STACK:\n${String(err.stack ?? "")}\n`;

		logToFile(file, body);
	},
	cacheDir,

	// "matrix" to test on multiple Obsidian versions (+ optional emulateMobile)
	capabilities: [
		...desktopVersions.map<WebdriverIO.Capabilities>(
			([appVersion, installerVersion]) => ({
				browserName: "obsidian",
				"wdio:obsidianOptions": {
					appVersion,
					installerVersion,
					plugins: ["."],
					vault: "tests/simple",
				},
			}),
		),
		...(includeMobile
			? mobileVersions.map<WebdriverIO.Capabilities>(
					([appVersion, installerVersion]) => ({
						browserName: "obsidian",
						"goog:chromeOptions": {
							mobileEmulation: {
								deviceMetrics: { height: 844, width: 390 },
							},
						},
						"wdio:obsidianOptions": {
							appVersion,
							emulateMobile: true,
							installerVersion,
							plugins: ["."],
							vault: "tests/simple",
						},
					}),
				)
			: []),
	],

	framework: "mocha",

	// Minimal WDIO noise; keep suite tree + Spec Files summary.
	logLevel: "silent",

	// How many instances of Obsidian should be launched in parallel during testing.
	maxInstances: Number(env.WDIO_MAX_INSTANCES || 8),

	mochaOpts: {
		timeout: 60 * 1000,
		ui: "bdd",
	},

	onComplete: function (exitCode, _config, _caps, results) {
		logToFile("run-summary.json", JSON.stringify({ exitCode, results }, null, 2));
	},

	// Noise filter installed at module load time (above)
	// onPrepare hook removed - filter runs earlier now

	onWorkerEnd: function (cid, exitCode, specs, retries) {
		const meta = { cid, exitCode, retries, specs };
		logToFile(`worker-end_${safeName(cid)}.json`, JSON.stringify(meta, null, 2));
	},

	onWorkerStart: function (cid, caps, specs) {
		const meta = {
			cid,
			// Obsidian caps are not typed by WebdriverIO
			obsidian: (caps as any)?.["wdio:obsidianOptions"],
			specs,
		};
		logToFile(`worker-start_${safeName(cid)}.json`, JSON.stringify(meta, null, 2));
	},
	outputDir,

	/**
	 * ✅ TL;DR reporter: suite tree with ✓/✖ only.
	 * Ensure you use the WDIOReporter-based implementation.
	 */
	reporters: [
		[
			path.resolve("./tests/obsidian-e2e/support/reporters/tldr-reporter.cjs"),
			{},
		],
	],
	runner: "local",
	services: ["obsidian"],

	// Tests
	specs: ["./tests/obsidian-e2e/**/*.e2e.ts"],
	waitforInterval: 250,
	waitforTimeout: 5 * 1000,
};