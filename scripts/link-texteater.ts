// Points `.texteater` at the texteater checkout whose battery packages the
// plugin type-checks, tests and bundles from source. tsconfig.json `paths`
// read the batteries through this link. Nothing is copied. Runs as
// `postinstall`, or as `bun run link:texteater`.
//
// The batteries are pinned per commit: `batteries.lock` holds the texteater
// commit SHA this commit of the plugin builds against. The link targets a
// git worktree of the shared clone at ~/work/texteater-clones/plugin,
// detached at that SHA, at ~/work/texteater-clones/plugin@<sha>. When that
// worktree is missing, this script fetches the shared clone, adds the
// worktree and runs `bun install` in it. Each SHA gets its own worktree, so
// branches locked to different SHAs build side by side. TEXTEATER_DIR
// overrides the target with any texteater checkout, which is linked as is.
// It never falls back to a texteater working checkout.
//
// `--warn-only` (used by postinstall) only warns when the target cannot be
// made, so `bun install` still works without texteater or a network;
// typecheck, tests and any build that imports a battery then fail.
//
// `--report` (run at build start) prints the locked SHA and the commit
// `.texteater` resolves to, and fails when they differ without TEXTEATER_DIR,
// so a build log records which batteries it bundled.
import {
	existsSync,
	lstatSync,
	mkdirSync,
	readFileSync,
	readlinkSync,
	realpathSync,
	symlinkSync,
	unlinkSync,
	writeFileSync,
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
const LOCK_FILE = path.join(REPO_ROOT, "batteries.lock");
const TEXTEATER_REMOTE = "https://github.com/clockblocker/texteater.git";
export const BRANCH = "main";
/** The shared clone every per-SHA worktree is added from. */
export const SHARED_CLONE = path.join(
	homedir(),
	"work",
	"texteater-clones",
	"plugin",
);

export function readLock(): string {
	if (!existsSync(LOCK_FILE)) throw new Error(`${LOCK_FILE} is missing.`);
	const sha = readFileSync(LOCK_FILE, "utf8").trim();
	if (!/^[0-9a-f]{40}$/u.test(sha)) {
		throw new Error(
			`${LOCK_FILE} must hold one full texteater commit SHA, not "${sha}".`,
		);
	}
	return sha;
}

export function writeLock(sha: string): void {
	writeFileSync(LOCK_FILE, `${sha}\n`);
}

/** The worktree of the shared clone detached at `sha`. */
export function worktreeFor(sha: string): string {
	return `${SHARED_CLONE}@${sha}`;
}

/** TEXTEATER_DIR, resolved, or undefined when unset. */
export function texteaterOverride(): string | undefined {
	const fromEnv = process.env.TEXTEATER_DIR;
	return fromEnv ? path.resolve(fromEnv) : undefined;
}

function missingBatteries(checkout: string): string[] {
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

/** Runs a command with inherited output; throws when it fails. */
export function run(cwd: string, command: string[]): void {
	const result = Bun.spawnSync(command, {
		cwd,
		stderr: "inherit",
		stdout: "inherit",
	});
	if (result.exitCode !== 0) {
		throw new Error(`${command.join(" ")} failed in ${cwd}.`);
	}
}

/** Clones texteater into the shared clone when it is missing. */
export function ensureSharedClone(): void {
	if (existsSync(SHARED_CLONE)) return;
	mkdirSync(path.dirname(SHARED_CLONE), { recursive: true });
	console.log(
		`[texteater] cloning ${TEXTEATER_REMOTE} into ${SHARED_CLONE}`,
	);
	run(path.dirname(SHARED_CLONE), [
		"git",
		"clone",
		"--branch",
		BRANCH,
		TEXTEATER_REMOTE,
		SHARED_CLONE,
	]);
}

function hasCommit(sha: string): boolean {
	return (
		Bun.spawnSync(["git", "cat-file", "-e", `${sha}^{commit}`], {
			cwd: SHARED_CLONE,
			stderr: "ignore",
			stdout: "ignore",
		}).exitCode === 0
	);
}

/**
 * The worktree for `sha`, made when missing: the shared clone is fetched
 * when it lacks the commit, a worktree is added detached at it under a
 * temporary name, `bun install` runs there, and only then is it moved to
 * its final path. A worktree at the final path is therefore installed, and
 * two installs racing for one SHA keep the first and drop the second.
 */
function ensureWorktree(sha: string): string {
	const worktree = worktreeFor(sha);
	if (existsSync(worktree)) return worktree;
	ensureSharedClone();
	if (!hasCommit(sha)) {
		console.log(`[texteater] fetching origin in ${SHARED_CLONE}`);
		run(SHARED_CLONE, ["git", "fetch", "origin"]);
		if (!hasCommit(sha)) {
			throw new Error(
				`texteater has no commit ${sha}; fix ${path.basename(LOCK_FILE)}.`,
			);
		}
	}
	const staging = `${worktree}.staging-${process.pid}`;
	console.log(`[texteater] adding worktree ${worktree}`);
	run(SHARED_CLONE, ["git", "worktree", "add", "--detach", staging, sha]);
	try {
		run(staging, ["bun", "install", "--frozen-lockfile"]);
		if (!existsSync(worktree)) {
			run(SHARED_CLONE, ["git", "worktree", "move", staging, worktree]);
		}
	} finally {
		if (existsSync(staging)) {
			run(SHARED_CLONE, ["git", "worktree", "remove", "--force", staging]);
		}
	}
	return worktree;
}

/** The checkout `.texteater` should point at, made when missing. */
export function resolveCheckout(): string {
	const override = texteaterOverride();
	const checkout = override ?? ensureWorktree(readLock());
	const missing = missingBatteries(checkout);
	if (missing.length > 0) {
		throw new Error(
			`${override ? `TEXTEATER_DIR=${process.env.TEXTEATER_DIR}` : checkout} has no battery/{${missing.join(",")}}/package.json.`,
		);
	}
	return checkout;
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

export function describeCommit(checkout: string): string {
	const commit = git(checkout, "log", "-1", "--format=%H %s");
	const dirty = git(checkout, "status", "--porcelain") === "" ? "" : " (dirty)";
	return `${commit}${dirty}`;
}

function reportTexteater(): void {
	const lock = readLock();
	console.log(`[texteater] batteries.lock ${lock}`);
	if (!existsSync(TEXTEATER_LINK)) {
		throw new Error(
			`${TEXTEATER_LINK} is missing or dangling. Run \`bun install\` or \`bun run link:texteater\`.`,
		);
	}
	const checkout = realpathSync(TEXTEATER_LINK);
	console.log(
		`[texteater] batteries from ${checkout} @ ${describeCommit(checkout)}`,
	);
	const head = git(checkout, "rev-parse", "HEAD");
	if (head === lock) return;
	if (texteaterOverride()) {
		console.log(
			"[texteater] TEXTEATER_DIR overrides the lock; this build is not the locked one.",
		);
		return;
	}
	throw new Error(
		`.texteater is at ${head}, not the locked ${lock}. Run \`bun install\` to relink.`,
	);
}

if (import.meta.main) {
	try {
		if (process.argv.includes("--report")) reportTexteater();
		else linkTexteater();
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		if (process.argv.includes("--warn-only")) {
			console.warn(`[link-texteater] warning: ${message}`);
		} else {
			console.error(`[link-texteater] ${message}`);
			process.exit(1);
		}
	}
}
