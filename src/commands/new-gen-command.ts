import { Editor, MarkdownView, Notice, TFile } from 'obsidian';
import TextEaterPlugin from '../main';
import { prompts } from '../prompts';
import { longDash } from '../utils';
import { unwrapMaybe } from 'types/general';

export default async function newGenCommand(plugin: TextEaterPlugin) {
	try {
		const file = unwrapMaybe(
			await plugin.openedFileService.getMaybeOpenedFile()
		);

		const word = file.name;
		// const [dictionaryEntry, froms, morphems, valence] = await Promise.all([
		// 	plugin.apiService.generateContent(
		// 		prompts.generate_dictionary_entry,
		// 		word
		// 	),
		// 	plugin.apiService.generateContent(prompts.generate_forms, word),
		// 	plugin.apiService.generateContent(prompts.morphems, word),
		// 	plugin.apiService.generateContent(prompts.generate_valence_block, word),
		// ]);

		const buttonsBlock = `<button id="execute-new-gen-command" class="execute-command-button" data-action="execute-new-gen-command">Open Today</button>`;

		// const adjForms = extractAdjectiveForms(froms);

		// const trimmedBaseEntrie = `${dictionaryEntry.replace('<agent_output>', '').replace('</agent_output>', '')}`;

		// const baseBlock = await incertClipbordContentsInContextsBlock(
		// 	incertYouglishLinkInIpa(trimmedBaseEntrie)
		// );
		// const morphemsBlock =
		// 	morphems.replace('\n', '') === longDash ? '' : `${morphems}\n`;
		// const valenceBlock =
		// 	valence.replace('\n', '') === longDash ? '' : `${valence}`;
		// const fromsBlock = froms.replace('\n', '') === longDash ? '' : `${froms}`;
		// const adjFormsBlock =
		// 	adjForms.replace('\n', '') === longDash ? '' : `${adjForms}`;

		const blocks = [buttonsBlock];

		const content = unwrapMaybe(
			await plugin.openedFileService.getMaybeContent()
		);

		if (content.trim() === '') {
			await Promise.all(
				blocks.map((block) => {
					plugin.openedFileService.writeToOpenedFile(block);
				})
			);
		} else {
			plugin.openedFileService.writeToOpenedFile(word);
		}

		const entrie = blocks.filter(Boolean).join('\n---\n');
		await plugin.openedFileService.writeToOpenedFile(entrie);

		// if (normalForm?.toLocaleLowerCase() === word.toLocaleLowerCase()) {
		// 	;
		// } else {
		// 	await plugin.deprecatedFileService.writeToOpenedFile(
		// 		file.path,
		// 		`[[${normalForm}]]`
		// 	);
		// 	await navigator.clipboard.writeText(entrie);
		// }
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
		return longDash;
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
