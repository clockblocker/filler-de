import { Editor, MarkdownView, Notice, TFile } from 'obsidian';
import TextEaterPlugin from '../../../main';
import { unwrapMaybe } from 'types/general';
import { LONG_DASH } from '../../../types/beta/literals';

export default async function updateActionsBlock(plugin: TextEaterPlugin) {
	try {
		// const file = unwrapMaybe(
		// 	await plugin.openedFileService.getMaybeOpenedFile()
		// );

		const prefixBlock = '\n';
		const postfixBlock = '\n';

		const buttonsBlock = ` <span class="note_block note_block_buttons">
<button id="execute-new-gen-command" class="execute-command-button" data-action="execute-new-gen-command">Generate</button>
<button class="hidden">I am an invisible button</button>
</span>
`;

		const blocks = [prefixBlock, buttonsBlock, postfixBlock];

		console.log('blocks', blocks);

		const fileContent = unwrapMaybe(
			await plugin.openedFileService.getMaybeFileContent()
		);

		if (fileContent.trim() === '') {
			await Promise.all(
				blocks.map((block) => {
					const a = plugin.openedFileService.writeToOpenedFile(block);
				})
			);
		} else {
			// Change the buttons to somehting meaningfull
			return null;
		}
	} catch (error) {
		new Notice(`Error: ${error.message}`);
	}
}

function extractBaseForms(text: string): string[] | null {
	const match = text.match(
		/Adjektive:\s*\[\[(.*?)\]\],\s*\[\[(.*?)\]\],\s*\[\[(.*?)\]\]/
	);
	if (!match) {
		return null;
	}

	const [_, base, comparative, superlative] = match;

	return [base, comparative, superlative];
}

function extractAdjectiveForms(text: string): string {
	const baseForms = extractBaseForms(text);

	if (!baseForms) {
		return LONG_DASH;
	}

	const endings = ['er', 'es', 'e', 'en', 'em'];

	const result: string[] = [];

	for (const suf of baseForms) {
		for (const end of endings) {
			result.push(`[[${suf + end}]]`);
		}
	}

	return result.join(', ');
}

function extractFirstBracketedWord(text: string) {
	const match = text.match(/\[\[([^\]]+)\]\]/);
	return match ? match[1] : null;
}

function getIPAIndexes(str: string) {
	const regex = /\[(?!\[)(.*?)(?<!\])\]/g;
	const matches = [];
	let match;

	while ((match = regex.exec(str)) !== null) {
		if (match.index === 0 || str[match.index - 1] !== '[') {
			matches.push([match.index, regex.lastIndex - 1]);
		}
	}

	return matches.length ? matches[0] : null;
}

function incertYouglishLinkInIpa(baseBlock: string) {
	const ipaI = getIPAIndexes(baseBlock);
	const word = extractFirstBracketedWord(baseBlock);

	if (!ipaI || !word) {
		return baseBlock;
	}

	const ipa1 = ipaI[1];

	if (!ipa1) {
		return baseBlock;
	}

	return (
		baseBlock.slice(0, ipa1 + 1) +
		`(https://youglish.com/pronounce/${word}/german)` +
		baseBlock.slice(ipa1 + 1)
	);
}

async function incertClipbordContentsInContextsBlock(
	baseBlock: string
): Promise<string> {
	try {
		let clipboardContent = '';
		if (typeof navigator !== 'undefined' && navigator.clipboard) {
			clipboardContent = await navigator.clipboard.readText();
		}
		const [first, ...rest] = baseBlock.split('---');

		if (rest.length >= 1) {
			// Insert clipboard content between the first two dividers
			return (
				first +
				'---\n' +
				clipboardContent.trim() +
				rest.map((a) => a.trim()).join('\n\n---\n') +
				'\n'
			);
		}

		return baseBlock;
	} catch (error) {
		console.error('Failed to read clipboard:', error);
		return baseBlock;
	}
}
