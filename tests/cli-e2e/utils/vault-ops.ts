import { CliError, obsidian } from "./cli";

/**
 * Create a file in the vault via CLI.
 * Auto-creates parent folders.
 */
export async function createFile(
	path: string,
	content = "",
): Promise<void> {
	// Escape content for shell: use base64 to avoid quoting issues
	if (content === "") {
		await obsidian(`create name="${path}" content="" silent`);
	} else {
		// Use eval to create files with content to avoid shell quoting issues
		const escaped = content.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/`/g, "\\`").replace(/\$/g, "\\$");
		await obsidian(
			`eval code="(async()=>{await app.vault.create('${path.replace(/'/g, "\\'")}','${escaped.replace(/'/g, "\\'")}');return 'ok'})()"`,
		);
	}
}

/**
 * Create multiple files sequentially.
 */
export async function createFiles(
	files: readonly { path: string; content?: string }[],
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
 * Rename or move a file/folder via CLI.
 */
export async function renamePath(
	oldPath: string,
	newPath: string,
): Promise<void> {
	await obsidian(`move path="${oldPath}" to="${newPath}"`);
}

/**
 * Delete a file or folder via CLI.
 */
export async function deletePath(path: string): Promise<void> {
	await obsidian(`delete path="${path}"`);
}

/**
 * Check if a file exists via CLI.
 * Uses `file path=X` — errors if not found.
 */
export async function fileExists(path: string): Promise<boolean> {
	try {
		await obsidian(`file path="${path}"`);
		return true;
	} catch (e) {
		if (e instanceof CliError && e.result.exitCode !== 0) {
			return false;
		}
		throw e;
	}
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
 * Lists all files then deletes them one by one.
 */
export async function deleteAllUnder(folder: string): Promise<void> {
	const files = await listFiles(folder);
	for (const file of files) {
		try {
			await deletePath(file);
		} catch {
			// Ignore errors (file may have been deleted by parent folder delete)
		}
	}
	// Try deleting the folder itself
	try {
		await deletePath(folder);
	} catch {
		// Folder may already be gone
	}
}
