import { type App, TFile } from "obsidian";
import type { PrettyPath } from "../../../../types/common-interface/dtos";
import {
	type Maybe,
	unwrapMaybeByThrowing,
} from "../../../../types/common-interface/maybe";
import {
	type FullPathToMdFile,
	fullPathToMdFileFromPrettyPath,
	systemPathFromFullPath,
} from "../../atomic-services/pathfinder";
import { getMaybeEditor } from "../../helpers/get-editor";
import { logError } from "../../helpers/issue-handlers";
import type { OpenedFileReader } from "./opened-file-reader";

export class OpenedFileService {
	private lastOpenedFiles: FullPathToMdFile[] = [];
	private reader: OpenedFileReader;

	constructor(
		private app: App,
		reader: OpenedFileReader,
	) {
		this.reader = reader;
		this.init();
	}

	private async init() {
		this.lastOpenedFiles.push(await this.reader.pwd());
	}

	async pwd() {
		return await this.reader.pwd();
	}

	getApp(): App {
		return this.app;
	}

	async getMaybeOpenedTFile(): Promise<Maybe<TFile>> {
		return await this.reader.getMaybeOpenedTFile();
	}

	async getMaybeContent(): Promise<Maybe<string>> {
		return await this.reader.getMaybeContent();
	}

	async getContent(): Promise<string> {
		return await this.reader.getContent();
	}

	// [TODO] Delete
	async writeToOpenedFile(text: string): Promise<Maybe<string>> {
		return { data: text, error: false };
	}

	async replaceAllContentInOpenedFile(
		content: string,
	): Promise<Maybe<string>> {
		const editor = unwrapMaybeByThrowing(await getMaybeEditor(this.app));
		editor.setValue(content);

		return { data: content, error: false };
	}

	async isFileActive(prettyPath: PrettyPath): Promise<boolean> {
		const pwd = await this.pwd();
		// Check both pathParts and basename to ensure it's the same file
		return (
			pwd.pathParts.length === prettyPath.pathParts.length &&
			pwd.pathParts.every(
				(part, index) => part === prettyPath.pathParts[index],
			) &&
			pwd.basename === prettyPath.basename
		);
	}

	public async cd(file: TFile): Promise<Maybe<TFile>>;
	public async cd(file: FullPathToMdFile): Promise<Maybe<TFile>>;
	public async cd(file: PrettyPath): Promise<Maybe<TFile>>;
	public async cd(
		file: TFile | FullPathToMdFile | PrettyPath,
	): Promise<Maybe<TFile>> {
		let tfile: TFile;
		if (
			typeof (file as TFile).path === "string" &&
			(file as TFile).extension !== undefined
		) {
			tfile = file as TFile;
		} else if (
			typeof (file as FullPathToMdFile).basename === "string" &&
			Array.isArray((file as FullPathToMdFile).pathParts)
		) {
			const full = fullPathToMdFileFromPrettyPath(file as PrettyPath);
			const systemPath = systemPathFromFullPath(full);

			const tfileMaybe = this.app.vault.getAbstractFileByPath(systemPath);
			if (!tfileMaybe || !(tfileMaybe instanceof TFile)) {
				const description = `No TFile found for path: ${systemPath}`;
				logError({ description, location: "OpenedFileService" });
				return { description, error: true };
			}
			tfile = tfileMaybe as TFile;
		} else {
			const description = "Invalid argument to OpenedFileService.cd";
			logError({ description, location: "OpenedFileService" });
			return { description, error: true };
		}

		try {
			await this.app.workspace.getLeaf(true).openFile(tfile);
			return { data: tfile, error: false };
		} catch (error) {
			const description = `Failed to open file: ${error}`;
			logError({
				description,
				location: "OpenedFileService",
			});
			return { description, error: true };
		}
	}

	// private showLoadingOverlay(): void {
	// 	if (document.getElementById("opened-file-service-loading-overlay")) {
	// 		return;
	// 	}
	// 	const overlay = document.createElement("div");
	// 	overlay.id = "opened-file-service-loading-overlay";

	// 	document.body.appendChild(overlay);

	// 	const loadingText = document.createElement("div");
	// 	loadingText.innerText = "Loading...";
	// 	loadingText.style.fontSize = "2rem";
	// 	loadingText.style.color = "#fff";
	// 	overlay.appendChild(loadingText);

	// 	// overlay.style.position = 'fixed';
	// 	// overlay.style.top = '0';
	// 	// overlay.style.left = '0';
	// 	// overlay.style.width = '100%';
	// 	// overlay.style.height = '100%';
	// 	// overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.5)'; // Semi-transparent black
	// 	// overlay.style.display = 'flex';
	// 	// overlay.style.justifyContent = 'center';
	// 	// overlay.style.alignItems = 'center';
	// 	// overlay.style.zIndex = '1000'; // Ensure it's on top
	// }

	// private hideLoadingOverlay(): void {
	// 	const overlay = document.getElementById(
	// 		"opened-file-service-loading-overlay",
	// 	);
	// 	if (overlay) {
	// 		overlay.remove();
	// 	}
	// }
}
