import { App, TFile, Vault } from 'obsidian';
import { ROOT, TEXT_ROOT, PAGE } from '../../../types/beta/literals';
import {
	extractMetaInfo,
	editOrAddMetaInfo,
} from '../../../pure-formatters/meta-info-manager/interface';
import { MetaInfo } from '../../../pure-formatters/meta-info-manager/types';

export interface TextStructure {
	textRootFile: TFile;
	pages: TFile[];
	textsRootFile?: TFile;
}

export class Currator {
	constructor(private app: App) {}

	/**
	 * Creates a text structure from the current file
	 * - Creates Texts/ folder if it doesn't exist
	 * - Creates xxx.md file with TEXT_ROOT metaInfo
	 * - Creates Pages/ folder with numbered page files
	 * - Updates Texts.md with link to xxx.md
	 */
	async createTextFromCurrentFile(
		currentFile: TFile,
		content: string
	): Promise<TextStructure> {
		const vault = this.app.vault;
		const fileName = currentFile.basename;

		// Create Texts folder structure
		await this.ensureTextsFolderStructure(vault);

		// Create text root file
		const textRootFile = await this.createTextRootFile(
			vault,
			fileName,
			content
		);

		// Split content into pages
		const pages = await this.createPagesFromContent(vault, fileName, content);

		// Update Texts.md with link to the new text
		await this.updateTextsRootFile(vault, fileName);
		const textsRootFile = await this.getTextsRootFile(vault);

		if (!textsRootFile) {
			throw new Error('Texts.md file not found');
		}

		return {
			textRootFile,
			pages,
			textsRootFile,
		};
	}

	/**
	 * Checks if the current file has empty metaInfo
	 */
	async hasEmptyMetaInfo(file: TFile) {
		const content = await this.app.vault.read(file);

		const metaInfo = extractMetaInfo(content);
		return !metaInfo;
	}

	/**
	 * Gets the current page number from a page file
	 */
	getPageNumber(pageFile: TFile): number {
		const match = pageFile.basename.match(/^(\d{4})-/);
		return match ? parseInt(match[1], 10) : 0;
	}

	/**
	 * Gets the next page file in sequence
	 */
	async getNextPage(currentPageFile: TFile): Promise<TFile | null> {
		const currentPageNumber = this.getPageNumber(currentPageFile);
		const nextPageNumber = currentPageNumber + 1;
		const nextPageName = `${nextPageNumber.toString().padStart(4, '0')}-${currentPageFile.basename.split('-').slice(1).join('-')}`;
		const nextPagePath = currentPageFile.path.replace(
			currentPageFile.name,
			nextPageName + '.md'
		);

		return (
			(this.app.vault.getAbstractFileByPath(nextPagePath) as TFile) || null
		);
	}

	/**
	 * Gets the previous page file in sequence
	 */
	async getPreviousPage(currentPageFile: TFile): Promise<TFile | null> {
		const currentPageNumber = this.getPageNumber(currentPageFile);
		if (currentPageNumber <= 0) return null;

		const prevPageNumber = currentPageNumber - 1;
		const prevPageName = `${prevPageNumber.toString().padStart(4, '0')}-${currentPageFile.basename.split('-').slice(1).join('-')}`;
		const prevPagePath = currentPageFile.path.replace(
			currentPageFile.name,
			prevPageName + '.md'
		);

		return (
			(this.app.vault.getAbstractFileByPath(prevPagePath) as TFile) || null
		);
	}

	/**
	 * Ensures the Texts folder structure exists
	 */
	private async ensureTextsFolderStructure(vault: Vault): Promise<void> {
		const textsFolder = 'Texts';
		const textsFile = `${textsFolder}/Texts.md`;

		// Create Texts folder if it doesn't exist
		if (!vault.getAbstractFileByPath(textsFolder)) {
			await vault.createFolder(textsFolder);
		}

		// Create Texts.md if it doesn't exist
		if (!vault.getAbstractFileByPath(textsFile)) {
			const textsContent = `# Texts\n\nThis is the root file for all texts.\n\n`;
			const metaInfo: MetaInfo = { fileType: ROOT };
			const contentWithMeta = editOrAddMetaInfo(textsContent, metaInfo);
			await vault.create(textsFile, contentWithMeta);
		}
	}

	/**
	 * Creates the text root file (xxx.md)
	 */
	private async createTextRootFile(
		vault: Vault,
		fileName: string,
		content: string
	): Promise<TFile> {
		const textRootPath = `Texts/${fileName}/${fileName}.md`;

		// Create the text folder
		const textFolder = `Texts/${fileName}`;
		if (!vault.getAbstractFileByPath(textFolder)) {
			await vault.createFolder(textFolder);
		}

		// Create the text root file
		const metaInfo: MetaInfo = { fileType: TEXT_ROOT };
		const contentWithMeta = editOrAddMetaInfo(content, metaInfo);
		await vault.create(textRootPath, contentWithMeta);

		return vault.getAbstractFileByPath(textRootPath) as TFile;
	}

	/**
	 * Creates pages from content by splitting it
	 */
	private async createPagesFromContent(
		vault: Vault,
		fileName: string,
		content: string
	): Promise<TFile[]> {
		const pagesFolder = `Texts/${fileName}/Pages`;

		// Create Pages folder
		if (!vault.getAbstractFileByPath(pagesFolder)) {
			await vault.createFolder(pagesFolder);
		}

		// Split content into pages (simple split by double newlines for now)
		const pageContents = this.splitContentIntoPages(content);
		const pages: TFile[] = [];

		for (let i = 0; i < pageContents.length; i++) {
			const pageNumber = i.toString().padStart(4, '0');
			const pageFileName = `${pageNumber}-${fileName}.md`;
			const pagePath = `${pagesFolder}/${pageFileName}`;

			const metaInfo: MetaInfo = { fileType: PAGE };
			const pageContent = editOrAddMetaInfo(pageContents[i], metaInfo);

			await vault.create(pagePath, pageContent);
			const pageFile = vault.getAbstractFileByPath(pagePath) as TFile;
			pages.push(pageFile);
		}

		return pages;
	}

	/**
	 * Splits content into pages (simple implementation)
	 */
	private splitContentIntoPages(content: string): string[] {
		// Simple split by double newlines, can be made more sophisticated
		const pages = content
			.split('\n\n')
			.filter((page) => page.trim().length > 0);

		// If no double newlines, split by single newlines
		if (pages.length === 1) {
			return content.split('\n').filter((line) => line.trim().length > 0);
		}

		return pages;
	}

	/**
	 * Updates Texts.md with a link to the new text
	 */
	private async updateTextsRootFile(
		vault: Vault,
		fileName: string
	): Promise<void> {
		const textsFile = 'Texts/Texts.md';
		const textFile = vault.getAbstractFileByPath(textsFile) as TFile;

		if (textFile) {
			const currentContent = await vault.read(textFile);
			const linkToAdd = `\n- [[${fileName}/${fileName}]]`;

			// Check if link already exists
			if (!currentContent.includes(linkToAdd)) {
				const updatedContent = currentContent + linkToAdd;
				await vault.modify(textFile, updatedContent);
			}
		}
	}

	/**
	 * Gets the Texts.md file
	 */
	private async getTextsRootFile(vault: Vault): Promise<TFile | null> {
		return (vault.getAbstractFileByPath('Texts/Texts.md') as TFile) || null;
	}

	/**
	 * Creates navigation links for a page file
	 */
	async createPageNavigationLinks(pageFile: TFile): Promise<string> {
		const [prevPage, nextPage] = await Promise.all([
			this.getPreviousPage(pageFile),
			this.getNextPage(pageFile),
		]);

		let navigation = '';

		if (prevPage) {
			navigation += `[[${prevPage.basename}|← Previous]] | `;
		}

		if (nextPage) {
			navigation += `[[${nextPage.basename}|Next →]]`;
		}

		return navigation;
	}
}
