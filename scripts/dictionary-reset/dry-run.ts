/**
 * Runs the dictionary reset's Dry run (#65, #117) over a vault directory on
 * disk, read-only, and prints the source folders it can read old notes
 * from, the one it used, its counts and its report. Point it at a copy,
 * never at the vault Obsidian has open:
 *
 *   bun --preload ./tests/unit/setup.ts scripts/dictionary-reset/dry-run.ts /tmp/tf-vault-copy
 *   bun --preload ./tests/unit/setup.ts scripts/dictionary-reset/dry-run.ts /tmp/tf-vault-copy --source="Worter backup 2026-10-21 05-43-21"
 *
 * Without `--source`, it uses the folder the modal suggests: `Worter/` when
 * it holds old notes, else the newest `Worter backup …` folder that does.
 */
import { Effect } from "effect";
import { dryRunReset } from "../../src/commanders/dictionary-reset/execute";
import { countPlan } from "../../src/commanders/dictionary-reset/report";
import { findSources } from "../../src/commanders/dictionary-reset/source";
import { dirResetVault } from "./dir-reset-vault";

const args = process.argv.slice(2);
const root = args.find((arg) => !arg.startsWith("--"));
const source = args
	.find((arg) => arg.startsWith("--source="))
	?.slice("--source=".length);
if (!root) {
	console.error(
		'Usage: dry-run.ts <vault directory> [--source="<Worter or a Worter backup folder>"]',
	);
	process.exit(1);
}
const vault = dirResetVault(root);
const sources = await Effect.runPromise(findSources(vault));
console.log("Source folders:");
for (const { folder, notes, oldNotes } of sources.candidates)
	console.log(
		`  ${folder === sources.suggested ? "*" : " "} ${folder}/: ${oldNotes} old of ${notes} notes`,
	);
const result = await Effect.runPromise(
	dryRunReset(vault, source === undefined ? {} : { source }),
);
console.log(`Source used: ${result.plan.source}/`);
console.log(JSON.stringify(countPlan(result.plan), null, 2));
console.log(result.report);
