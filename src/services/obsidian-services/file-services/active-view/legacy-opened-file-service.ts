import { type App, TFile } from "obsidian";
import { getMaybeLegacyEditor } from "../../../../obsidian-vault-action-manager/helpers/get-editor";
import { logError } from "../../../../obsidian-vault-action-manager/helpers/issue-handlers";
import type { PrettyPathLegacy } from "../../../../types/common-interface/dtos";
import {
	type MaybeLegacy,
	unwrapMaybeLegacyByThrowing,
} from "../../../../types/common-interface/maybe";
import {
	type LegacyFullPathToMdFile,
	legacyFullPathToMdFileFromPrettyPathLegacy,
	legacySystemPathFromFullPath,
} from "../../atomic-services/pathfinder";
import type { LegacyOpenedFileReader } from "./opened-file-reader";

export class LegacyOpenedFileService {
	private lastOpenedFiles: LegacyFullPathToMdFile[] = [];
	private reader: LegacyOpenedFileReader;

	constructor(
		private app: App,
		reader: LegacyOpenedFileReader,
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

	async getMaybeLegacyOpenedTFile(): Promise<MaybeLegacy<TFile>> {
		return await this.reader.getMaybeLegacyOpenedTFile();
	}

	async getMaybeLegacyContent(): Promise<MaybeLegacy<string>> {
		return await this.reader.getMaybeLegacyContent();
	}

	async getContent(): Promise<string> {
		return await this.reader.getContent();
	}

	// [TODO] Delete
	async writeToOpenedFile(text: string): Promise<MaybeLegacy<string>> {
		return { data: text, error: false };
	}

	async replaceAllContentInOpenedFile(
		content: string,
	): Promise<MaybeLegacy<string>> {
		const editor = unwrapMaybeLegacyByThrowing(
			await getMaybeLegacyEditor(this.app),
		);
		editor.setValue(content);

		return { data: content, error: false };
	}

	async isFileActive(prettyPath: PrettyPathLegacy): Promise<boolean> {
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

	public async cd(file: TFile): Promise<MaybeLegacy<TFile>>;
	public async cd(file: LegacyFullPathToMdFile): Promise<MaybeLegacy<TFile>>;
	public async cd(file: PrettyPathLegacy): Promise<MaybeLegacy<TFile>>;
	public async cd(
		file: TFile | LegacyFullPathToMdFile | PrettyPathLegacy,
	): Promise<MaybeLegacy<TFile>> {
		let tfile: TFile;
		if (
			typeof (file as TFile).path === "string" &&
			(file as TFile).extension !== undefined
		) {
			tfile = file as TFile;
		} else if (
			typeof (file as LegacyFullPathToMdFile).basename === "string" &&
			Array.isArray((file as LegacyFullPathToMdFile).pathParts)
		) {
			const full = legacyFullPathToMdFileFromPrettyPathLegacy(
				file as PrettyPathLegacy,
			);
			const systemPath = legacySystemPathFromFullPath(full);

			const tfileMaybeLegacy =
				this.app.vault.getAbstractFileByPath(systemPath);
			if (!tfileMaybeLegacy || !(tfileMaybeLegacy instanceof TFile)) {
				const description = `No TFile found for path: ${systemPath}`;
				logError({ description, location: "OpenedFileService" });
				return { description, error: true };
			}
			tfile = tfileMaybeLegacy as TFile;
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
