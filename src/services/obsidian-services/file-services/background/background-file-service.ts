import type { FileManager, Vault } from "obsidian";
import type { PrettyPath } from "../../../../types/common-interface/dtos";
import { isReadonlyArray } from "../../../../types/helpers";
import { splitPathToMdFileFromPrettyPath } from "../pathfinder";
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

	create(file: PrettyFileWithContent): Promise<void>;
	create(files: readonly PrettyFileWithContent[]): Promise<void>;

	async create(
		arg: PrettyFileWithContent | readonly PrettyFileWithContent[],
	): Promise<void> {
		if (isReadonlyArray(arg)) {
			return await this.abstractFileService.createFiles(
				arg.map(({ prettyPath, ...rest }) => ({
					...rest,
					splitPath: splitPathToMdFileFromPrettyPath(prettyPath),
				})),
			);
		}

		const { prettyPath, ...rest } = arg;
		return await this.abstractFileService.createFiles([
			{
				content: rest.content,
				splitPath: splitPathToMdFileFromPrettyPath(prettyPath),
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
}

type PrettyFileWithContent = { prettyPath: PrettyPath; content?: string };
type PrettyFileFromTo = { from: PrettyPath; to: PrettyPath };
