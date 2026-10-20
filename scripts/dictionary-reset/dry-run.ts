/**
 * Runs the dictionary reset's Dry run (#65) over a vault directory on
 * disk, read-only, and prints its counts and report. Point it at a copy,
 * never at the vault Obsidian has open:
 *
 *   bun --tsconfig-override=tsconfig.json scripts/dictionary-reset/dry-run.ts /tmp/tf-vault-copy
 */
import { Effect } from "effect";
import { dryRunReset } from "../../src/commanders/dictionary-reset/execute";
import { countPlan } from "../../src/commanders/dictionary-reset/report";
import { dirResetVault } from "./dir-reset-vault";

const root = process.argv[2];
if (!root) {
	console.error("Usage: dry-run.ts <vault directory with a Worter/ folder>");
	process.exit(1);
}
const result = await Effect.runPromise(dryRunReset(dirResetVault(root)));
console.log(JSON.stringify(countPlan(result.plan), null, 2));
console.log(result.report);
