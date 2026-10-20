// `bun run batteries:sync`: brings the dedicated texteater clone the plugin
// builds against to texteater's origin/main, then points `.texteater` at it.
//
// The clone lives at TEXTEATER_DIR, or at ~/work/texteater-clones/plugin by
// default. It is ours, not a texteater working checkout: this script clones
// it when missing, fast-forwards it otherwise, and runs `bun install` inside
// it. It refuses to touch a clone with local changes, one on a branch other
// than main, or one whose main has diverged from origin/main.
//
// The clone is shared by every checkout and worktree of the plugin, so a sync
// moves the batteries under all of them.
import { existsSync, mkdirSync, realpathSync } from "node:fs";
import path from "node:path";
import {
	describeCommit,
	git,
	linkTexteater,
	missingBatteries,
	texteaterDir,
} from "./link-texteater";

const TEXTEATER_REMOTE = "https://github.com/clockblocker/texteater.git";
const BRANCH = "main";

function run(cwd: string, command: string[]): void {
	const result = Bun.spawnSync(command, {
		cwd,
		stderr: "inherit",
		stdout: "inherit",
	});
	if (result.exitCode !== 0) {
		throw new Error(`${command.join(" ")} failed in ${cwd}.`);
	}
}

function cloneTexteater(clone: string): void {
	mkdirSync(path.dirname(clone), { recursive: true });
	console.log(`[batteries:sync] cloning ${TEXTEATER_REMOTE} into ${clone}`);
	run(path.dirname(clone), [
		"git",
		"clone",
		"--branch",
		BRANCH,
		TEXTEATER_REMOTE,
		clone,
	]);
}

function fastForwardTexteater(clone: string): void {
	if (git(clone, "rev-parse", "--show-toplevel") !== realpathSync(clone)) {
		throw new Error(`${clone} is not the root of a git repository.`);
	}
	const changes = git(clone, "status", "--porcelain");
	if (changes !== "") {
		throw new Error(
			`${clone} has local changes; refusing to sync:\n${changes}`,
		);
	}
	const branch = git(clone, "branch", "--show-current");
	if (branch !== BRANCH) {
		throw new Error(
			`${clone} is on "${branch || "a detached HEAD"}", not ${BRANCH}; refusing to sync.`,
		);
	}
	console.log(`[batteries:sync] fetching origin in ${clone}`);
	run(clone, ["git", "fetch", "origin", BRANCH]);
	const ahead = git(clone, "rev-list", "--count", `origin/${BRANCH}..HEAD`);
	if (ahead !== "0") {
		throw new Error(
			`${clone} ${BRANCH} has ${ahead} commit(s) not on origin/${BRANCH}; refusing to sync.`,
		);
	}
	run(clone, ["git", "merge", "--ff-only", "--quiet", `origin/${BRANCH}`]);
}

function syncTexteater(): void {
	const clone = texteaterDir();
	if (existsSync(clone)) fastForwardTexteater(clone);
	else cloneTexteater(clone);

	const missing = missingBatteries(clone);
	if (missing.length > 0) {
		throw new Error(
			`${clone} has no battery/{${missing.join(",")}}/package.json.`,
		);
	}

	console.log(`[batteries:sync] bun install in ${clone}`);
	run(clone, ["bun", "install", "--frozen-lockfile"]);

	linkTexteater(clone);
	console.log(`[batteries:sync] pinned texteater ${describeCommit(clone)}`);
}

if (import.meta.main) {
	try {
		syncTexteater();
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		console.error(`[batteries:sync] ${message}`);
		process.exit(1);
	}
}
