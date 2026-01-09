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

	const handle = (chunk: any, origWrite: typeof process.stdout.write) => {
		const s =
			typeof chunk === "string"
				? chunk
				: chunk?.toString?.("utf8") ?? String(chunk);

		const lines = s.split(/\r?\n/);

		let passthrough = "";
		for (const line of lines) {
			if (line.length === 0) {
				passthrough += "\n";
				continue;
			}
			if (shouldDeny(line)) buffer.push(line);
			else passthrough += line + "\n";
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

	/**
	 * Install noise filter in launcher process.
	 * (The TL;DR reporter output will still pass through.)
	 */
	onPrepare: function () {
		installStdIoNoiseFilter({
			deny: [
				/^Execution of \d+ workers started/,
				/^\[\d+-\d+\]\s+(RUNNING|FAILED)/,
				/^\[\d+-\d+\]\s+SYNCHRONOUS TERMINATION NOTICE:/,
				/^error: script ".*" exited with code \d+/,
				/^Bundled \d+ modules in \d+ms/,
				/^\s*main\.js\s+\d+/,
			],
			logFile: "wdio-noise-launcher.log",
		});
	},

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