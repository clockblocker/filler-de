#!/usr/bin/env bun
/**
 * Fire a Lemma command on a surface string inside a source file.
 *
 * Usage:
 *   bun scripts/runbook/lemma-fire.ts Mann
 *   bun scripts/runbook/lemma-fire.ts "fängt"
 *
 * Environment variables (all optional, have defaults):
 *   VAULT       - vault name          (default: cli-e2e-test-vault)
 *   SRC         - source file path    (default: Outside/Textfresser-Lemma-Manual.md)
 *   PLUGIN_ID   - plugin id           (default: cbcr-text-eater-de)
 *   OBSIDIAN_BIN - path to binary     (default: /Applications/Obsidian.app/Contents/MacOS/Obsidian)
 *   TIMEOUT_MS  - eval timeout in ms  (default: 15000)
 */

const VAULT = process.env.VAULT ?? "cli-e2e-test-vault";
const SRC = process.env.SRC ?? "Outside/Textfresser-Lemma-Manual.md";
const PLUGIN_ID = process.env.PLUGIN_ID ?? "cbcr-text-eater-de";
const BIN =
	process.env.OBSIDIAN_BIN ??
	"/Applications/Obsidian.app/Contents/MacOS/Obsidian";
const TIMEOUT_MS = Number(process.env.TIMEOUT_MS ?? "15000");

const surface = process.argv[2];
if (!surface) {
	console.error("Usage: bun scripts/runbook/lemma-fire.ts <surface>");
	console.error('Example: bun scripts/runbook/lemma-fire.ts "Mann"');
	process.exit(1);
}

// Build eval code as a single line.
// Surface is defined as a JS variable inside the eval — avoids interpolation issues.
const code =
	`(async()=>{` +
	`const p=app.plugins.plugins["${PLUGIN_ID}"];` +
	`const tf=p.textfresser;` +
	`const path="${SRC}";` +
	`const file=app.vault.getAbstractFileByPath(path);` +
	`if(!file)throw new Error("not found");` +
	`const content=await app.vault.read(file);` +
	`const surface="${surface}";` +
	`const start=content.indexOf(surface);` +
	`if(start===-1)throw new Error("not found: "+surface);` +
	`const lines=content.split("\\n");` +
	`let ls=0;let block=null;` +
	`for(const l of lines){const le=ls+l.length;if(start>=ls&&start<=le){block=l;break}ls=le+1}` +
	`const parts=path.split("/");const fn=parts.pop();const dot=fn.lastIndexOf(".");` +
	`const sp={basename:fn.slice(0,dot),extension:fn.slice(dot+1),kind:"MdFile",pathParts:parts};` +
	`tf.executeCommand("Lemma",{activeFile:{content,splitPath:sp},selection:{selectionStartInBlock:start-ls,splitPathToFileWithSelection:sp,surroundingRawBlock:block,text:surface}},()=>{});` +
	`return "fired"})()`;

const proc = Bun.spawn([BIN, `vault=${VAULT}`, "eval", `code=${code}`], {
	stdout: "pipe",
	stderr: "pipe",
});

const timer = setTimeout(() => {
	proc.kill();
	console.error("TIMEOUT after", TIMEOUT_MS, "ms");
	process.exit(1);
}, TIMEOUT_MS);

const stdout = await new Response(proc.stdout).text();
const stderr = await new Response(proc.stderr).text();
clearTimeout(timer);

// Strip CLI noise
const out = stdout
	.replace(/.*Loading updated app package.*\n?/g, "")
	.trim();
const err = stderr
	.replace(/.*Loading updated app package.*\n?/g, "")
	.trim();

if (out.startsWith("Error:")) {
	console.error(out);
	if (err) console.error(err);
	process.exit(1);
}

// Success: "=> fired"
console.log(out.replace(/^=> /, ""));
