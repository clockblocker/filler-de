import { obsidian, obsidianEval } from "../../cli-e2e/utils/cli";

function quoteCli(value: string): string {
	return `"${value
		.replace(/\\/g, "\\\\")
		.replace(/"/g, '\\"')
		.replace(/\n/g, "\\n")}"`;
}

function assertNoCliError(stdout: string, command: string): void {
	if (stdout.startsWith("Error:")) {
		throw new Error(`CLI command failed: ${command}\n${stdout}`);
	}
}

export async function ensureFolder(path: string): Promise<void> {
	const parts = path.split("/").filter(Boolean);
	if (parts.length === 0) return;

	const folders: string[] = [];
	for (let i = 1; i <= parts.length; i++) {
		folders.push(parts.slice(0, i).join("/"));
	}

	const escapedFolders = folders
		.map((folder) => `'${folder.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`)
		.join(",");
	await obsidianEval(
		`(async()=>{for(const folder of [${escapedFolders}]){try{await app.vault.createFolder(folder)}catch(_error){}}return 'ok'})()`,
	);
}

export async function createExactFile(
	path: string,
	content: string,
): Promise<void> {
	const parent = path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "";
	if (parent) {
		await ensureFolder(parent);
	}

	const command = `create path=${quoteCli(path)} content=${quoteCli(content)} overwrite`;
	const result = await obsidian(command);
	assertNoCliError(result.stdout, command);
}

export async function createExactBinaryFile(
	path: string,
	bytes: readonly number[] = [0],
): Promise<void> {
	const parent = path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "";
	if (parent) {
		await ensureFolder(parent);
	}

	const escapedPath = path.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
	const encodedBytes = bytes.join(",");
	await obsidianEval(
		`(async()=>{const data=new Uint8Array([${encodedBytes}]);await app.vault.createBinary('${escapedPath}',data.buffer);return 'ok'})()`,
	);
}

export async function readExactFile(path: string): Promise<string> {
	const command = `read path=${quoteCli(path)}`;
	const result = await obsidian(command);
	assertNoCliError(result.stdout, command);
	return result.stdout;
}

export async function deleteExactFile(path: string): Promise<void> {
	const command = `delete path=${quoteCli(path)} permanent`;
	const result = await obsidian(command);
	assertNoCliError(result.stdout, command);
}

export async function renameExactFile(
	path: string,
	name: string,
): Promise<void> {
	const command = `rename path=${quoteCli(path)} name=${quoteCli(name)}`;
	const result = await obsidian(command);
	assertNoCliError(result.stdout, command);
}

export async function renameAnyPath(
	fromPath: string,
	toPath: string,
): Promise<void> {
	const escapedFromPath = fromPath.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
	const escapedToPath = toPath.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
	await obsidianEval(
		`(async()=>{const file=app.vault.getAbstractFileByPath('${escapedFromPath}');if(!file){throw new Error('Not found: ${escapedFromPath}')}await app.fileManager.renameFile(file,'${escapedToPath}');return 'ok'})()`,
	);
}

export async function deleteAnyPath(path: string): Promise<void> {
	const escapedPath = path.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
	await obsidianEval(
		`(async()=>{const file=app.vault.getAbstractFileByPath('${escapedPath}');if(file){await app.vault.trash(file,true)}return 'ok'})()`,
	);
}

export async function exactPathExists(path: string): Promise<boolean> {
	const command = `file path=${quoteCli(path)}`;
	const result = await obsidian(command);
	return !result.stdout.startsWith("Error:");
}

export async function listExactFiles(folder?: string): Promise<string[]> {
	const command = folder
		? `files folder=${quoteCli(folder)}`
		: "files";
	const result = await obsidian(command);
	assertNoCliError(result.stdout, command);
	if (!result.stdout) return [];
	return result.stdout.split("\n").filter(Boolean);
}
