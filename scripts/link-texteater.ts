// Points `.texteater` at the texteater clone whose battery packages the
// plugin type-checks, tests and bundles from source. tsconfig.json `paths`
// read the batteries through this link. Nothing is copied, and nothing is
// written inside texteater. Runs as `postinstall`, or as
// `bun run link:texteater`.
//
// The link targets TEXTEATER_DIR when set, otherwise the dedicated clone at
// ~/work/texteater-clones/plugin that `bun run batteries:sync` keeps at
// texteater's origin/main. It never falls back to a texteater working
// checkout, so the build does not depend on whatever that checkout holds.
//
// `--if-present` (used by postinstall) only warns when the clone is missing,
// so `bun install` still works without texteater; typecheck, tests and any
// build that imports a battery then fail on the missing modules.
//
// `--report` (run at build start) prints the texteater commit `.texteater`
// points at, so a build log records which batteries it bundled.
import {
	existsSync,
	lstatSync,
	readFileSync,
	readlinkSync,
	realpathSync,
	symlinkSync,
	unlinkSync,
} from "node:fs";
import { homedir } from "node:os";
import path from "node:path";

export const BATTERY_PACKAGES = [
	"common-utils",
	"dumling",
	"dumrel",
	"dumcorpus",
	"dumdict",
	"dumgen",
] as const;

export const REPO_ROOT = path.resolve(import.meta.dir, "..");
export const TEXTEATER_LINK = path.join(REPO_ROOT, ".texteater");
const DEFAULT_TEXTEATER_DIR = path.join(
	homedir(),
	"work",
	"texteater-clones",
	"plugin",
);

export function texteaterDir(): string {
	const fromEnv = process.env.TEXTEATER_DIR;
	return fromEnv ? path.resolve(fromEnv) : DEFAULT_TEXTEATER_DIR;
}

export function missingBatteries(checkout: string): string[] {
	return BATTERY_PACKAGES.filter((name) => {
		const manifestPath = path.join(
			checkout,
			"battery",
			name,
			"package.json",
		);
		if (!existsSync(manifestPath)) return true;
		const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
			name?: string;
		};
		return manifest.name !== name;
	});
}

function resolveCheckout(): string {
	const checkout = texteaterDir();
	const missing = missingBatteries(checkout);
	if (missing.length === 0) return checkout;
	if (process.env.TEXTEATER_DIR) {
		throw new Error(
			`TEXTEATER_DIR=${process.env.TEXTEATER_DIR} has no battery/{${missing.join(",")}}/package.json.`,
		);
	}
	throw new Error(
		`No texteater clone at ${checkout}. Run \`bun run batteries:sync\` to clone it, or set TEXTEATER_DIR.`,
	);
}

export function linkTexteater(checkout = resolveCheckout()): void {
	const existing = lstatSync(TEXTEATER_LINK, { throwIfNoEntry: false });
	if (existing) {
		if (!existing.isSymbolicLink()) {
			throw new Error(
				`${TEXTEATER_LINK} exists and is not a symlink; move it away first.`,
			);
		}
		if (path.resolve(REPO_ROOT, readlinkSync(TEXTEATER_LINK)) === checkout) {
			console.log(`[link-texteater] .texteater -> ${checkout}`);
			return;
		}
		unlinkSync(TEXTEATER_LINK);
	}
	symlinkSync(checkout, TEXTEATER_LINK, "dir");
	console.log(`[link-texteater] linked .texteater -> ${checkout}`);
}

export function git(cwd: string, ...args: string[]): string {
	const result = Bun.spawnSync(["git", ...args], {
		cwd,
		stderr: "pipe",
		stdout: "pipe",
	});
	if (result.exitCode !== 0) {
		throw new Error(
			`git ${args.join(" ")} failed in ${cwd}: ${result.stderr.toString().trim()}`,
		);
	}
	return result.stdout.toString().trimEnd();
}

export function describeCommit(checkout: string): string {
	const commit = git(checkout, "log", "-1", "--format=%H %s");
	const dirty = git(checkout, "status", "--porcelain") === "" ? "" : " (dirty)";
	return `${commit}${dirty}`;
}

function reportTexteater(): void {
	if (!existsSync(TEXTEATER_LINK)) {
		throw new Error(
			`${TEXTEATER_LINK} is missing or dangling. Run \`bun run batteries:sync\`, or set TEXTEATER_DIR and run \`bun run link:texteater\`.`,
		);
	}
	const checkout = realpathSync(TEXTEATER_LINK);
	console.log(
		`[texteater] batteries from ${checkout} @ ${describeCommit(checkout)}`,
	);
}

if (import.meta.main) {
	try {
		if (process.argv.includes("--report")) reportTexteater();
		else linkTexteater();
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		if (process.argv.includes("--if-present")) {
			console.warn(`[link-texteater] warning: ${message}`);
		} else {
			console.error(`[link-texteater] ${message}`);
			process.exit(1);
		}
	}
}
