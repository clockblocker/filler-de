// `bun run batteries:sync [--bump]`: makes the texteater worktree for the
// SHA in `batteries.lock`, points `.texteater` at it, and prints the pinned
// commit.
//
// `--bump` first fetches the shared clone at ~/work/texteater-clones/plugin
// and moves the lock to texteater's origin/main. Commit the changed
// `batteries.lock`: other checkouts and worktrees pick it up when they check
// out or rebase onto that commit and run `bun install`. A bump never changes
// the batteries under another branch, because each SHA has its own
// worktree at ~/work/texteater-clones/plugin@<sha>.
//
// The script never touches the shared clone's own working tree, and never
// writes into a TEXTEATER_DIR checkout: with TEXTEATER_DIR set, it links
// that directory as is.
import {
	BRANCH,
	describeCommit,
	ensureSharedClone,
	git,
	linkTexteater,
	readLock,
	resolveCheckout,
	run,
	SHARED_CLONE,
	writeLock,
} from "./link-texteater";

function bumpLock(): void {
	ensureSharedClone();
	console.log(`[batteries:sync] fetching origin in ${SHARED_CLONE}`);
	run(SHARED_CLONE, ["git", "fetch", "origin", BRANCH]);
	const previous = readLock();
	const next = git(SHARED_CLONE, "rev-parse", `origin/${BRANCH}^{commit}`);
	if (next === previous) {
		console.log(`[batteries:sync] batteries.lock is at origin/${BRANCH}`);
		return;
	}
	writeLock(next);
	console.log(`[batteries:sync] batteries.lock ${previous} -> ${next}`);
}

if (import.meta.main) {
	try {
		if (process.argv.includes("--bump")) bumpLock();
		const checkout = resolveCheckout();
		linkTexteater(checkout);
		console.log(`[batteries:sync] pinned texteater ${describeCommit(checkout)}`);
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		console.error(`[batteries:sync] ${message}`);
		process.exit(1);
	}
}
