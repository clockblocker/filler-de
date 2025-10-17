import { App, TFile, Vault } from 'obsidian';
import { CODEX } from '../../../types/beta/literals';
import {
	extractMetaInfo,
	editOrAddMetaInfo,
} from '../../../pure-formatters/meta-info-manager/interface';
import type { PrettyPath } from '../../../types/general';

export class BookKeeper {
	constructor() {}

	// createBookFromFileContent({ title, content }: UnstructuredText): BookFiles {
	// 	const pages = this.splitIntoPages({ title, content });
	// 	const codex = this.makeCodex({ title, pages });

	// 	return {
	// 		textRootFile,
	// 		pages,
	// 		textsRootFile,
	// 	};
	// }

	// async hasEmptyMetaInfo(file: TFile) {
	// 	const content = await this.app.vault.read(file);

	// 	const metaInfo = extractMetaInfo(content);
	// 	return !metaInfo;
	// }

	// getPageNumber(pageFile: TFile): number {
	// 	const match = pageFile.basename.match(/^(\d{4})-/);
	// 	return match ? parseInt(match[1], 10) : 0;
	// }

	// async getNextPage(currentPageFile: TFile): Promise<TFile | null> {
	// 	const currentPageNumber = this.getPageNumber(currentPageFile);
	// 	const nextPageNumber = currentPageNumber + 1;
	// 	const nextPageName = `${nextPageNumber.toString().padStart(4, '0')}-${currentPageFile.basename.split('-').slice(1).join('-')}`;
	// 	const nextPagePath = currentPageFile.path.replace(
	// 		currentPageFile.name,
	// 		nextPageName + '.md'
	// 	);

	// 	return (
	// 		(this.app.vault.getAbstractFileByPath(nextPagePath) as TFile) || null
	// 	);
	// }

	// async getPreviousPage(currentPageFile: TFile): Promise<TFile | null> {
	// 	const currentPageNumber = this.getPageNumber(currentPageFile);
	// 	if (currentPageNumber <= 0) return null;

	// 	const prevPageNumber = currentPageNumber - 1;
	// 	const prevPageName = `${prevPageNumber.toString().padStart(4, '0')}-${currentPageFile.basename.split('-').slice(1).join('-')}`;
	// 	const prevPagePath = currentPageFile.path.replace(
	// 		currentPageFile.name,
	// 		prevPageName + '.md'
	// 	);

	// 	return (
	// 		(this.app.vault.getAbstractFileByPath(prevPagePath) as TFile) || null
	// 	);
	// }

	// private async ensureTextsFolderStructure(vault: Vault): Promise<void> {
	// 	const textsFolder = 'Texts';
	// 	const textsFile = `${textsFolder}/Texts.md`;

	// 	if (!vault.getAbstractFileByPath(textsFolder)) {
	// 		await vault.createFolder(textsFolder);
	// 	}

	// 	if (!vault.getAbstractFileByPath(textsFile)) {
	// 		const textsContent = `# Texts\n\nThis is the root file for all texts.\n\n`;
	// 		const metaInfo: MetaInfo = { fileType: ROOT };
	// 		const contentWithMeta = editOrAddMetaInfo(textsContent, metaInfo);
	// 		await vault.create(textsFile, contentWithMeta);
	// 	}
	// }

	// private async createPagesFromContent(
	// 	vault: Vault,
	// 	fileName: string,
	// 	content: string
	// ): Promise<TFile[]> {
	// 	const pagesFolder = `Texts/${fileName}/Pages`;

	// 	if (!vault.getAbstractFileByPath(pagesFolder)) {
	// 		await vault.createFolder(pagesFolder);
	// 	}

	// 	const pageContents = this.splitContentIntoPages(content);
	// 	const pages: TFile[] = [];

	// 	for (let i = 0; i < pageContents.length; i++) {
	// 		const pageNumber = i.toString().padStart(4, '0');
	// 		const pageFileName = `${pageNumber}-${fileName}.md`;
	// 		const pagePath = `${pagesFolder}/${pageFileName}`;

	// 		const metaInfo: MetaInfo = { fileType: PAGE };
	// 		const pageContent = editOrAddMetaInfo(pageContents[i], metaInfo);

	// 		await vault.create(pagePath, pageContent);
	// 		const pageFile = vault.getAbstractFileByPath(pagePath) as TFile;
	// 		pages.push(pageFile);
	// 	}

	// 	return pages;
	// }

	// private splitContentIntoPages(content: string): string[] {
	// 	const pages = content
	// 		.split('\n\n')
	// 		.filter((page) => page.trim().length > 0);

	// 	if (pages.length === 1) {
	// 		return content.split('\n').filter((line) => line.trim().length > 0);
	// 	}

	// 	return pages;
	// }

	// private async updateTextsRootFile(
	// 	vault: Vault,
	// 	fileName: string
	// ): Promise<void> {
	// 	const textsFile = 'Texts/Texts.md';
	// 	const textFile = vault.getAbstractFileByPath(textsFile) as TFile;

	// 	if (textFile) {
	// 		const currentContent = await vault.read(textFile);
	// 		const linkToAdd = `\n- [[${fileName}/${fileName}]]`;

	// 		// Check if link already exists
	// 		if (!currentContent.includes(linkToAdd)) {
	// 			const updatedContent = currentContent + linkToAdd;
	// 			await vault.modify(textFile, updatedContent);
	// 		}
	// 	}
	// }

	// /**
	//  * Gets the Texts.md file
	//  */
	// private async getTextsRootFile(vault: Vault): Promise<TFile | null> {
	// 	return (vault.getAbstractFileByPath('Texts/Texts.md') as TFile) || null;
	// }

	// /**
	//  * Creates navigation links for a page file
	//  */
	// async createPageNavigationLinks(pageFile: TFile): Promise<string> {
	// 	const [prevPage, nextPage] = await Promise.all([
	// 		this.getPreviousPage(pageFile),
	// 		this.getNextPage(pageFile),
	// 	]);

	// 	let navigation = '';

	// 	if (prevPage) {
	// 		navigation += `[[${prevPage.basename}|← Previous]] | `;
	// 	}

	// 	if (nextPage) {
	// 		navigation += `[[${nextPage.basename}|Next →]]`;
	// 	}

	// 	return navigation;
	// }
}

type Page = {
	title: PrettyPath['title'];
	content: string;
};

export type Book = {
	title: string;
	codex: PrettyPath['title'];
	pages: Page[];
};

export type BookFiles = {
	codex: TFile;
	pages: TFile[];
};

type UnstructuredText = {
	title: string;
	content: string;
};
