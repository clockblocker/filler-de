import { obsidian, obsidianEval } from "./cli";

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
		// Escape for single-quoted JS string inside eval
		const contentEscaped = content
			.replace(/\\/g, "\\\\")
			.replace(/'/g, "\\'")
			.replace(/\n/g, "\\n")
			.replace(/\r/g, "\\r");
		const pathEscaped = path.replace(/'/g, "\\'");
		await obsidianEval(
			`(async()=>{await app.vault.create('${pathEscaped}','${contentEscaped}');return 'ok'})()`,
		);
	}
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
