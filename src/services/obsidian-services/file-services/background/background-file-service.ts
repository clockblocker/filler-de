import type { FileManager, Vault } from "obsidian";
import type { PrettyPath } from "../../../../types/common-interface/dtos";
import { isReadonlyArray } from "../../../../types/helpers";
import { splitPathToMdFileFromPrettyPath } from "../pathfinder";
import type { SplitPathToFolder } from "../types";
import { AbstractFileHelper } from "./abstract-file-helper";

export class BackgroundFileService {
	private abstractFileService: AbstractFileHelper;
	private vault: Vault;

	constructor({
		vault,
		fileManager,
	}: { vault: Vault; fileManager: FileManager }) {
		this.vault = vault;
		this.abstractFileService = new AbstractFileHelper({
			fileManager,
			vault,
		});
	}

	async readContent(prettyPath: PrettyPath) {
		const file = await this.abstractFileService.getMdFile(
			splitPathToMdFileFromPrettyPath(prettyPath),
		);
		return await this.vault.read(file);
	}

	async replaceContent(prettyPath: PrettyPath, content = "") {
		const file = await this.abstractFileService.getMdFile(
			splitPathToMdFileFromPrettyPath(prettyPath),
		);
		await this.vault.modify(file, content);

		return content;
	}

	create(file: PrettyFileDto): Promise<void>;
	create(files: readonly PrettyFileDto[]): Promise<void>;

	async create(arg: PrettyFileDto | readonly PrettyFileDto[]): Promise<void> {
		if (isReadonlyArray(arg)) {
			return await this.abstractFileService.createFiles(
				arg.map((file) => ({
					...file,
					splitPath: splitPathToMdFileFromPrettyPath(file),
				})),
			);
		}

		return await this.abstractFileService.createFiles([
			{
				content: arg.content,
				splitPath: splitPathToMdFileFromPrettyPath(arg),
			},
		]);
	}

	move(file: PrettyFileFromTo): Promise<void>;
	move(files: readonly PrettyFileFromTo[]): Promise<void>;

	async move(
		arg: PrettyFileFromTo | readonly PrettyFileFromTo[],
	): Promise<void> {
		if (isReadonlyArray(arg)) {
			return await this.abstractFileService.moveFiles(
				arg.map(({ from, to }) => ({
					from: splitPathToMdFileFromPrettyPath(from),
					to: splitPathToMdFileFromPrettyPath(to),
				})),
			);
		}

		const { from, to } = arg;
		return await this.abstractFileService.moveFiles([
			{
				from: splitPathToMdFileFromPrettyPath(from),
				to: splitPathToMdFileFromPrettyPath(to),
			},
		]);
	}

	trash(file: PrettyPath): Promise<void>;
	trash(files: readonly PrettyPath[]): Promise<void>;
	async trash(arg: PrettyPath | readonly PrettyPath[]): Promise<void> {
		if (isReadonlyArray(arg)) {
			return await this.abstractFileService.trashFiles(
				arg.map((file) => splitPathToMdFileFromPrettyPath(file)),
			);
		}

		return await this.abstractFileService.trashFiles([
			splitPathToMdFileFromPrettyPath(arg),
		]);
	}

	rename(file: PrettyFileFromTo): Promise<void>;
	rename(files: readonly PrettyFileFromTo[]): Promise<void>;

	async rename(
		arg: PrettyFileFromTo | readonly PrettyFileFromTo[],
	): Promise<void> {
		if (isReadonlyArray(arg)) {
			return await this.move(arg);
		}
		return await this.move(arg);
	}

	async ls(pathToFoulder: SplitPathToFolder): Promise<PrettyFileDto[]> {
		const files =
			await this.abstractFileService.deepListMdFiles(pathToFoulder);

		console.log(files);
		return files;
	}
}

export type PrettyFileDto = PrettyPath & {
	content?: string;
};
type PrettyFileFromTo = { from: PrettyFileDto; to: PrettyFileDto };
