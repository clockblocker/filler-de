import type { TFile, Vault } from "obsidian";
import type { PrettyPathToMdFile } from "../../../../types/common-interface/dtos";
import { AbstractFileHelper } from "./abstract-file-helper";
import { splitPathFromPrettyPath } from "./helpers/functions";

export class BackgroundFileService {
	private abstractFileService: AbstractFileHelper;

	constructor(private vault: Vault) {
		this.abstractFileService = new AbstractFileHelper(this.vault);
	}

	async readContent(prettyPath: PrettyPathToMdFile) {
		const file = await this.getFile(prettyPath);
		return await this.vault.read(file);
	}

	async replaceContent(prettyPath: PrettyPathToMdFile, content = "") {
		const file = await this.getFile(prettyPath);
		await this.vault.modify(file, content);

		return content;
	}

	create(file: FileWithContent): Promise<void>;
	create(files: readonly FileWithContent[]): Promise<void>;

	async create(
		arg: FileWithContent | readonly FileWithContent[],
	): Promise<void> {
		if (isReadonlyArray(arg)) {
			return await this.abstractFileService.createManyFiles(
				arg.map(({ prettyPath, ...rest }) => ({
					...rest,
					path: splitPathFromPrettyPath(prettyPath),
				})),
			);
		}

		const { prettyPath, ...rest } = arg;
		return await this.abstractFileService.createFile({
			...rest,
			path: splitPathFromPrettyPath(prettyPath),
		});
	}

	move(file: FileFromTo): Promise<void>;
	move(files: readonly FileFromTo[]): Promise<void>;

	async move(arg: FileFromTo | readonly FileFromTo[]): Promise<void> {
		if (isReadonlyArray(arg)) {
			return await this.abstractFileService.moveManyFiles(
				arg.map(({ from, to }) => ({
					from: splitPathFromPrettyPath(from),
					to: splitPathFromPrettyPath(to),
				})),
			);
		}

		const { from, to } = arg;
		return await this.abstractFileService.moveFile({
			from: splitPathFromPrettyPath(from),
			to: splitPathFromPrettyPath(to),
		});
	}

	delete(file: PrettyPathToMdFile): Promise<void>;
	delete(files: readonly PrettyPathToMdFile[]): Promise<void>;

	async delete(
		arg: PrettyPathToMdFile | readonly PrettyPathToMdFile[],
	): Promise<void> {
		if (isReadonlyArray(arg)) {
			return this.abstractFileService.deleteManyFiles(
				arg.map((prettyPath) => ({
					prettyPath: splitPathFromPrettyPath(prettyPath),
				})),
			);
		}

		return await this.abstractFileService.deleteFile({
			prettyPath: splitPathFromPrettyPath(prettyPath),
		});
	}

	rename(file: FileFromTo): Promise<void>;
	rename(files: readonly FileFromTo[]): Promise<void>;

	async rename(arg: FileFromTo | readonly FileFromTo[]): Promise<void> {
		if (isReadonlyArray(arg)) {
			return await this.move(arg);
		}
		return await this.move(arg);
	}

	private async getFile(prettyPath: PrettyPathToMdFile): Promise<TFile> {
		return await this.abstractFileService.getAbstractFile(
			splitPathFromPrettyPath(prettyPath),
		);
	}
}

// async ls(path: SplitPathToFolder): Promise<Array<PrettyPathToMdFile>> {
// 	return [];
// }

// async lsDeep(path: SplitPathToFolder): Promise<Array<PrettyPathToMdFile>> {
// 	return [];
// }

type FileWithContent = { prettyPath: PrettyPathToMdFile; content?: string };
type FileFromTo = { from: PrettyPathToMdFile; to: PrettyPathToMdFile };

const isReadonlyArray = <T>(x: T | readonly T[]): x is readonly T[] =>
	Array.isArray(x);
