import {
	TFile,
	Vault,
	MetadataCache,
	Editor,
	normalizePath,
	Notice,
} from 'obsidian';
import { doesFileContainContent, appendToFile } from 'utils';
import { Backlink } from '../zod/types';

export async function addLinksToRelatedToBlock(
	vault: Vault,
	filePath: string,
	links: string[]
): Promise<void> {
	const file = vault.getAbstractFileByPath(filePath);
	if (!file || !(file instanceof TFile)) {
		console.error('File not found or is not a valid file');
		return;
	}

	let content = await vault.read(file);

	const formattedTags = links.map((link) =>
		link.startsWith('#') ? link : `#${link}`
	);

	const tagBlockRegex = /^(\*Tags\*:\s*)(.*)$/m;

	if (tagBlockRegex.test(content)) {
		content = content.replace(tagBlockRegex, (match, prefix, existingTags) => {
			const existingTagsArr = existingTags
				.split(/\s+/)
				.filter((t: string) => t.trim() !== '');
			const combinedTagsSet = new Set([...existingTagsArr, ...formattedTags]);
			const updatedTagsLine = prefix + Array.from(combinedTagsSet).join(' ');

			return updatedTagsLine;
		});
	} else {
		const tagLine = `*Tags*: ${formattedTags.join(' ')}`;
		content += `\n---\n\n${tagLine}`;
	}

	await vault.modify(file, content);
}

export async function addTagsToTagBlock(
	vault: Vault,
	file: TFile,
	tags: string[]
): Promise<void> {
	let content = await vault.read(file);

	const formattedTags = tags.map((tag) =>
		tag.startsWith('#') ? tag : `#${tag}`
	);

	const tagBlockRegex = /^(\*Tags\*:\s*)(.*)$/m;

	if (tagBlockRegex.test(content)) {
		content = content.replace(tagBlockRegex, (match, prefix, existingTags) => {
			const existingTagsArr = existingTags
				.split(/\s+/)
				.filter((t: string) => t.trim() !== '');
			const combinedTagsSet = new Set([...existingTagsArr, ...formattedTags]);
			const updatedTagsLine = prefix + Array.from(combinedTagsSet).join(' ');

			return updatedTagsLine;
		});
	} else {
		const tagLine = `*Tags*: ${formattedTags.join(' ')}`;
		content += `\n---\n\n${tagLine}`;
	}

	await vault.modify(file, content);
}

export default async function populateBacklinks(
	vault: Vault,
	filePath: string,
	metadataCache: MetadataCache,
	editor: Editor,
	backlinks: Backlink[]
) {
	try {
		const file = vault.getAbstractFileByPath(filePath);
		if (!file || !(file instanceof TFile)) {
			console.error('File not found or is not a valid file');
			return;
		}
		// const file = vault.getAbstractFileByPath(filePath);
		editor.refresh();
	} catch (error) {
		new Notice(`Error processing backlinks: ${error.message}`);
	}
}
