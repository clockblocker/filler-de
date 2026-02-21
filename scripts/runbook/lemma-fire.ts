#!/usr/bin/env bun
/**
 * Reliable Lemma trigger for manual runbook usage.
 *
 * Steps:
 * 1) Invoke textfresser.executeCommand("Lemma", context) and await result
 * 2) wait plugin.whenIdle()
 * 3) verify source contains wikilink for surface
 * 4) fallback: editor selection + command-id execution
 */

type LemmaExecResult = {
	ok: boolean;
	reason: string | null;
	strategy: "command-id" | "textfresser";
};

const VAULT = process.env.VAULT ?? "cli-e2e-test-vault";
const SRC = process.env.SRC ?? "Outside/Textfresser-Lemma-Manual.md";
const PLUGIN_ID = process.env.PLUGIN_ID ?? "cbcr-text-eater-de";
const BIN =
	process.env.OBSIDIAN_BIN ??
	"/Applications/Obsidian.app/Contents/MacOS/Obsidian";
const TIMEOUT_MS = Number(process.env.TIMEOUT_MS ?? "20000");
const LINK_TIMEOUT_MS = Number(process.env.LINK_TIMEOUT_MS ?? "12000");

const surface = process.argv[2];
if (!surface) {
	console.error("Usage: bun scripts/runbook/lemma-fire.ts <surface>");
	process.exit(1);
}

function stripCliNoise(text: string): string {
	return text
		.replace(/.*Loading updated app package.*\n?/g, "")
		.replace(/.*Checking for updates.*\n?/g, "")
		.trim();
}

async function runEval(code: string): Promise<string> {
	const proc = Bun.spawn([BIN, `vault=${VAULT}`, "eval", `code=${code}`], {
		stderr: "pipe",
		stdout: "pipe",
	});

	const timer = setTimeout(() => {
		proc.kill();
	}, TIMEOUT_MS);

	const stdout = await new Response(proc.stdout).text();
	const stderr = await new Response(proc.stderr).text();
	const exitCode = await proc.exited;
	clearTimeout(timer);

	const out = stripCliNoise(stdout);
	const err = stripCliNoise(stderr);

	if (exitCode !== 0) {
		throw new Error(
			`CLI exited with code ${exitCode}: ${out || "<no stdout>"} ${err || "<no stderr>"}`,
		);
	}
	if (out.startsWith("Error:")) {
		throw new Error(`${out}${err ? `\n${err}` : ""}`);
	}
	return out.replace(/^=> /, "");
}

async function runCli(args: string[]): Promise<string> {
	const proc = Bun.spawn([BIN, `vault=${VAULT}`, ...args], {
		stderr: "pipe",
		stdout: "pipe",
	});

	const timer = setTimeout(() => {
		proc.kill();
	}, TIMEOUT_MS);

	const stdout = await new Response(proc.stdout).text();
	const stderr = await new Response(proc.stderr).text();
	const exitCode = await proc.exited;
	clearTimeout(timer);

	const out = stripCliNoise(stdout);
	const err = stripCliNoise(stderr);

	if (exitCode !== 0) {
		throw new Error(
			`CLI exited with code ${exitCode}: ${out || "<no stdout>"} ${err || "<no stderr>"}`,
		);
	}
	if (out.startsWith("Error:")) {
		throw new Error(`${out}${err ? `\n${err}` : ""}`);
	}
	return out;
}

function isLinked(content: string, s: string): boolean {
	return content.includes(`[[${s}]]`) || content.includes(`|${s}]]`);
}

async function sleep(ms: number): Promise<void> {
	await new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForLink(surfaceText: string): Promise<boolean> {
	const start = Date.now();
	while (Date.now() - start < LINK_TIMEOUT_MS) {
		const content = await runCli(["read", `path=${SRC}`]);
		if (isLinked(content, surfaceText)) {
			return true;
		}
		await sleep(400);
	}
	return false;
}

const srcLiteral = JSON.stringify(SRC);
const surfaceLiteral = JSON.stringify(surface);
const pluginLiteral = JSON.stringify(PLUGIN_ID);
const commandIdLiteral = JSON.stringify(`${PLUGIN_ID}:lemma`);

const waitIdleCode =
	`(async()=>{` +
	`const plugin=app.plugins.plugins[${pluginLiteral}];` +
	`if(!plugin)throw new Error('plugin missing');` +
	`await plugin.whenIdle();` +
	`return 'idle';` +
	`})()`;

const textfresserExecCode =
	`(async()=>{` +
	`const plugin=app.plugins.plugins[${pluginLiteral}];` +
	`if(!plugin||!plugin.textfresser)return JSON.stringify({ok:false,strategy:'textfresser',reason:'plugin-missing'});` +
	`const tf=plugin.textfresser;` +
	`const path=${srcLiteral};` +
	`const file=app.vault.getAbstractFileByPath(path);` +
	`if(!file)return JSON.stringify({ok:false,strategy:'textfresser',reason:'file-missing'});` +
	`const content=await app.vault.read(file);` +
	`const surface=${surfaceLiteral};` +
	`const start=content.indexOf(surface);` +
	`if(start===-1)return JSON.stringify({ok:false,strategy:'textfresser',reason:'surface-not-found'});` +
	`const lines=content.split('\\\\n');` +
	`let lineStart=0;let surroundingRawBlock=null;` +
	`for(const line of lines){const lineEnd=lineStart+line.length;if(start>=lineStart&&start<=lineEnd){surroundingRawBlock=line;break}lineStart=lineEnd+1}` +
	`if(surroundingRawBlock===null)return JSON.stringify({ok:false,strategy:'textfresser',reason:'block-not-found'});` +
	`const parts=path.split('/');const fileName=parts.pop();if(!fileName)return JSON.stringify({ok:false,strategy:'textfresser',reason:'splitpath-file'});` +
	`const dot=fileName.lastIndexOf('.');if(dot===-1)return JSON.stringify({ok:false,strategy:'textfresser',reason:'splitpath-ext'});` +
	`const splitPath={basename:fileName.slice(0,dot),extension:fileName.slice(dot+1),kind:'MdFile',pathParts:parts};` +
	`const result=await tf.executeCommand('Lemma',{activeFile:{content,splitPath},selection:{selectionStartInBlock:start-lineStart,splitPathToFileWithSelection:splitPath,surroundingRawBlock,text:surface}},()=>{});` +
	`if(result.isErr&&result.isErr()){const e=result.error||{};return JSON.stringify({ok:false,strategy:'textfresser',reason:String(e.kind||'unknown')+':'+String(e.reason||'')});}` +
	`return JSON.stringify({ok:true,strategy:'textfresser',reason:null});` +
	`})()`;

const commandRouteExecCode =
	`(async()=>{` +
	`const path=${srcLiteral};` +
	`const selectedText=${surfaceLiteral};` +
	`const file=app.vault.getAbstractFileByPath(path);` +
	`if(!file)return JSON.stringify({ok:false,strategy:'command-id',reason:'file-missing'});` +
	`const leaf=app.workspace.getMostRecentLeaf()??app.workspace.getLeaf(true);` +
	`await leaf.openFile(file,{active:true});` +
	`const view=leaf.view;` +
	`if(view&&typeof view.getMode==='function'&&typeof view.setMode==='function'&&view.getMode()!=='source'){await view.setMode('source')}` +
	`const editor=(view&&'editor' in view&&view.editor)?view.editor:app.workspace.activeEditor?.editor;` +
	`if(!editor)return JSON.stringify({ok:false,strategy:'command-id',reason:'no-editor'});` +
	`const content=editor.getValue();` +
	`const start=content.indexOf(selectedText);` +
	`if(start===-1)return JSON.stringify({ok:false,strategy:'command-id',reason:'surface-not-found'});` +
	`const offsetToPos=(offset)=>{const prefix=content.slice(0,offset);const lines=prefix.split('\\\\n');const line=lines.length-1;const ch=lines[line]?.length??0;return {line,ch}};` +
	`const from=offsetToPos(start);const to=offsetToPos(start+selectedText.length);` +
	`editor.setSelection(from,to);` +
	`if(typeof editor.focus==='function'){editor.focus();}` +
	`await new Promise((resolve)=>setTimeout(resolve,50));` +
	`const ok=app.commands.executeCommandById(${commandIdLiteral});` +
	`if(!ok)return JSON.stringify({ok:false,strategy:'command-id',reason:'command-failed'});` +
	`return JSON.stringify({ok:true,strategy:'command-id',reason:null});` +
	`})()`;

async function executeByStrategy(
	strategy: "command-id" | "textfresser",
): Promise<LemmaExecResult> {
	const raw =
		strategy === "textfresser"
			? await runEval(textfresserExecCode)
			: await runEval(commandRouteExecCode);

	if (!raw) {
		return {
			ok: false,
			reason: "empty-cli-response",
			strategy,
		};
	}

	try {
		return JSON.parse(raw) as LemmaExecResult;
	} catch {
		return {
			ok: false,
			reason: `unexpected-response:${raw}`,
			strategy,
		};
	}
}

const beforeContent = await runCli(["read", `path=${SRC}`]);
const beforeLinked = isLinked(beforeContent, surface);
if (beforeLinked) {
	console.log("fired (already-linked)");
	process.exit(0);
}

const firstTry = await executeByStrategy("textfresser");
if (!firstTry.ok && firstTry.reason !== "empty-cli-response") {
	console.error(
		`lemma-fire first strategy failed [${firstTry.strategy}]: ${firstTry.reason ?? "unknown"}`,
	);
}

try {
	await runEval(waitIdleCode);
} catch {}
if (await waitForLink(surface)) {
	console.log("fired (textfresser)");
	process.exit(0);
}

const fallbackTry = await executeByStrategy("command-id");
if (!fallbackTry.ok && fallbackTry.reason !== "empty-cli-response") {
	console.error(
		`lemma-fire fallback failed [${fallbackTry.strategy}]: ${fallbackTry.reason ?? "unknown"}`,
	);
}

try {
	await runEval(waitIdleCode);
} catch {}
if (await waitForLink(surface)) {
	console.log("fired (command-id)");
	process.exit(0);
}

console.error("lemma-fire failed: command(s) executed but source remains unlinked");
process.exit(1);
