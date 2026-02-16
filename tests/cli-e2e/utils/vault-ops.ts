import { readFileSync } from "node:fs";
import { obsidian, obsidianEval } from "./cli";

function escapeForSingleQuotedJs(value: string): string {
	return value
		.replace(/\\/g, "\\\\")
		.replace(/'/g, "\\'")
		.replace(/\n/g, "\\n")
		.replace(/\r/g, "\\r");
}

/**
 * Ensure all ancestor folders exist for the given file path.
 * Uses Obsidian API `vault.createFolder()` via eval.
 */
async function ensureParentFolders(filePath: string): Promise<void> {
	const parts = filePath.split("/");
	if (parts.length <= 1) return; // root-level file, no folders needed

	// Build each ancestor path and create if missing
	const folders: string[] = [];
	for (let i = 1; i < parts.length; i++) {
		folders.push(parts.slice(0, i).join("/"));
	}

	const escapedFolders = folders
		.map((f) => `'${f.replace(/'/g, "\\'")}'`)
		.join(",");
	const code = `(async()=>{for(const f of [${escapedFolders}]){try{await app.vault.createFolder(f)}catch(e){}}return 'ok'})()`;
	await obsidianEval(code);
}

/**
 * Create a file in the vault via CLI.
 * Auto-creates parent folders via eval.
 */
export async function createFile(
	path: string,
	content = "",
): Promise<void> {
	await ensureParentFolders(path);

	if (content === "") {
		await obsidian(`create name="${path}" content="" silent`);
	} else {
		const contentEscaped = escapeForSingleQuotedJs(content);
		const pathEscaped = escapeForSingleQuotedJs(path);
		await obsidianEval(
			`(async()=>{await app.vault.create('${pathEscaped}','${contentEscaped}');return 'ok'})()`,
		);
	}
}

/**
 * Copy a UTF-8 file from local disk into the test vault.
 * Destination is vault-relative path.
 */
export async function copyLocalFileToVault(
	sourceAbsolutePath: string,
	destinationVaultPath: string,
): Promise<void> {
	const content = readFileSync(sourceAbsolutePath, "utf8");
	await createFile(destinationVaultPath, content);
}

/**
 * Create multiple files sequentially.
 */
export async function createFiles(
	files: readonly { content?: string; path: string }[],
): Promise<void> {
	for (const file of files) {
		await createFile(file.path, file.content ?? "");
	}
}

/**
 * Read file content via CLI.
 */
export async function readFile(path: string): Promise<string> {
	const result = await obsidian(`read path="${path}"`);
	return result.stdout;
}

/**
 * Rename or move a file/folder.
 * Uses fileManager.renameFile via eval (CLI `move` only handles files).
 */
export async function renamePath(
	oldPath: string,
	newPath: string,
): Promise<void> {
	const oldEscaped = oldPath.replace(/'/g, "\\'");
	const newEscaped = newPath.replace(/'/g, "\\'");
	await obsidianEval(
		`(async()=>{const f=app.vault.getAbstractFileByPath('${oldEscaped}');if(!f)throw new Error('Not found: ${oldEscaped}');await app.fileManager.renameFile(f,'${newEscaped}');return 'ok'})()`,
	);
}

/**
 * Delete a file or folder via eval (CLI `delete` only handles files).
 */
export async function deletePath(path: string): Promise<void> {
	const pathEscaped = path.replace(/'/g, "\\'");
	await obsidianEval(
		`(async()=>{const f=app.vault.getAbstractFileByPath('${pathEscaped}');if(f)await app.vault.trash(f,true);return 'ok'})()`,
	);
}

/**
 * Check if a file/folder exists via Obsidian API.
 * Uses eval (CLI `file` returns exit 0 even on "not found").
 */
export async function fileExists(path: string): Promise<boolean> {
	const pathEscaped = path.replace(/'/g, "\\'");
	const result = await obsidianEval(
		`(async()=>{const f=app.vault.getAbstractFileByPath('${pathEscaped}');return f?'yes':'no'})()`,
	);
	return result === "yes";
}

/**
 * List files in a folder via CLI.
 */
export async function listFiles(
	folder?: string,
	ext?: string,
): Promise<string[]> {
	let cmd = "files";
	if (folder) cmd += ` folder="${folder}"`;
	if (ext) cmd += ` ext=${ext}`;
	const result = await obsidian(cmd);
	if (!result.stdout) return [];
	return result.stdout.split("\n").filter(Boolean);
}

/**
 * Delete all files under a folder (for cleanup).
 * Deletes the folder and all its contents via Obsidian API.
 */
export async function deleteAllUnder(folder: string): Promise<void> {
	await deletePath(folder);
}

/**
 * Toggle a checkbox in a codex file by calling librarian.handleCodexCheckboxClick().
 * Bypasses DOM/CodeMirror — exercises the full business pipeline directly.
 *
 * @param codexPath - Vault-relative path, e.g. "Library/Recipe/Pie/Fish/__-Fish-Pie-Recipe.md"
 * @param lineContent - Text after "- [ ] " prefix, e.g. "[[Steps-Fish-Pie-Recipe|Steps]]"
 * @param wasChecked - PRE-toggle state: false = was unchecked (user wants to check → Done)
 */
export async function toggleCodexCheckbox(
	codexPath: string,
	lineContent: string,
	wasChecked: boolean,
): Promise<void> {
	const codexPathEscaped = codexPath.replace(/'/g, "\\'");
	const lineContentEscaped = lineContent.replace(/'/g, "\\'");
	const code = `(async()=>{const plugin=app.plugins.plugins['cbcr-text-eater-de'];const parts='${codexPathEscaped}'.replace(/\\.md$/,'').split('/');const basename=parts.pop();const payload={checked:${wasChecked},kind:'CheckboxClicked',lineContent:'${lineContentEscaped}',splitPath:{basename,pathParts:parts,extension:'md',kind:'MdFile'}};await plugin.librarian.handleCodexCheckboxClick(payload);return 'ok'})()`;
	await obsidianEval(code);
}

/**
 * Open a markdown file, select first occurrence of text, and execute a command.
 * Selection + command invocation happen inside a single eval for consistency.
 */
export async function executeCommandOnSelection(params: {
	commandId: string;
	path: string;
	selectedText: string;
}): Promise<void> {
	const { commandId, path, selectedText } = params;
	const commandIdEscaped = escapeForSingleQuotedJs(commandId);
	const pathEscaped = escapeForSingleQuotedJs(path);
	const selectedTextEscaped = escapeForSingleQuotedJs(selectedText);

	const code = `(async()=>{const file=app.vault.getAbstractFileByPath('${pathEscaped}');if(!file)throw new Error('File not found: ${pathEscaped}');const leaf=app.workspace.getMostRecentLeaf()??app.workspace.getLeaf(true);await leaf.openFile(file,{active:true});const view=leaf.view;if(view&&typeof view.getMode==='function'&&typeof view.setMode==='function'&&view.getMode()!=='source'){await view.setMode('source')}const editor=(view&&'editor' in view&&view.editor)?view.editor:app.workspace.activeEditor?.editor;if(!editor)throw new Error('No active markdown editor for: ${pathEscaped}');const content=editor.getValue();const start=content.indexOf('${selectedTextEscaped}');if(start===-1)throw new Error('Selected text not found: ${selectedTextEscaped}');const offsetToPos=(offset)=>{const prefix=content.slice(0,offset);const lines=prefix.split('\\n');const line=lines.length-1;const ch=lines[line]?.length??0;return {line,ch}};const from=offsetToPos(start);const to=offsetToPos(start+'${selectedTextEscaped}'.length);editor.setSelection(from,to);if(typeof editor.focus==='function'){editor.focus()}const ok=app.commands.executeCommandById('${commandIdEscaped}');if(!ok)throw new Error('Command failed or not found: ${commandIdEscaped}');return 'ok'})()`;

	await obsidianEval(code);
}
