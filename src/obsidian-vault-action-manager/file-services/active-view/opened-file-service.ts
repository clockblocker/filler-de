import { type App, TFile } from "obsidian";
import { getMaybeEditor } from "../../../../obsidian-vault-action-manager/helpers/get-editor";
import { logError } from "../../../../obsidian-vault-action-manager/helpers/issue-handlers";
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
import type { LegacyOpenedFileReader } from "./opened-file-reader";

export class LegacyOpenedFileService {
	private lastOpenedFiles: FullPathToMdFile[] = [];
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
}
