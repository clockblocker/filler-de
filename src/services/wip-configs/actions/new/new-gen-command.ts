import { Notice } from "obsidian";
import { unwrapMaybe } from "../../../../types/common-interface/maybe";
import { LONG_DASH } from "../../../../types/literals";
import type { TexfresserObsidianServices } from "../../../obsidian-services/interface";

export default async function newGenCommand(
	services: TexfresserObsidianServices,
) {
	try {
		const file = unwrapMaybe(
			await services.openedFileService.getMaybeOpenedFile(),
		);

		const word = file.name;
		// const [dictionaryEntry, froms, morphems, valence] = await Promise.all([
		// 	services.apiService.generateContent(
		// 		prompts.generate_dictionary_entry,
		// 		word
		// 	),
		// 	services.apiService.generateContent(prompts.generate_forms, word),
		// 	services.apiService.generateContent(prompts.morphems, word),
		// 	services.apiService.generateContent(prompts.generate_valence_block, word),
		// ]);

		const buttonsBlock = ` <span class="note_block note_block_buttons">
<button id="execute-new-gen-command" class="execute-command-button" data-action="execute-new-gen-command">Open Today</button>
<button class="hidden">i do not do shit</button>
</span>
`;

		// const adjForms = extractAdjectiveForms(froms);

		// const trimmedBaseEntrie = `${dictionaryEntry.replace('<agent_output>', '').replace('</agent_output>', '')}`;

		// const baseBlock = await incertClipbordContentsInContextsBlock(
		// 	incertYouglishLinkInIpa(trimmedBaseEntrie)
		// );
		// const morphemsBlock =
		// 	morphems.replace('\n', '') === LONG_DASH ? '' : `${morphems}\n`;
		// const valenceBlock =
		// 	valence.replace('\n', '') === LONG_DASH ? '' : `${valence}`;
		// const fromsBlock = froms.replace('\n', '') === LONG_DASH ? '' : `${froms}`;
		// const adjFormsBlock =
		// 	adjForms.replace('\n', '') === LONG_DASH ? '' : `${adjForms}`;

		const blocks = [buttonsBlock];

		const fileContent = unwrapMaybe(
			await services.openedFileService.getMaybeFileContent(),
		);

		// const exisingBlocks = services.blockManager.extractAllBlocks(fileContent);

		// console.log('exisingBlocks', exisingBlocks);

		if (fileContent.trim() === "") {
			await Promise.all(
				blocks.map((block) => {
					const a =
						services.openedFileService.writeToOpenedFile(block);
				}),
			);
		} else {
			// Change the buttons to somehting meaningfull
			return null;
		}

		const entrie = blocks.filter(Boolean).join("\n---\n");

		// if (normalForm?.toLocaleLowerCase() === word.toLocaleLowerCase()) {
		// 	;
		// } else {
		// 	await services.deprecatedFileService.writeToOpenedFile(
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
		/Adjektive:\s*\[\[(.*?)\]\],\s*\[\[(.*?)\]\],\s*\[\[(.*?)\]\]/,
	);
	if (!match) {
		return null;
	}

	const [_, base, comparative, superlative] = match;

	return [base ?? "", comparative ?? "", superlative ?? ""];
}

function extractAdjectiveForms(text: string): string {
	const baseForms = extractBaseForms(text);

	if (!baseForms) {
		return LONG_DASH;
	}

	const endings = ["er", "es", "e", "en", "em"];

	const result: string[] = [];

	for (const suf of baseForms) {
		for (const end of endings) {
			result.push(`[[${suf + end}]]`);
		}
	}

	return result.join(", ");
}

function extractFirstBracketedWord(text: string) {
	const match = text.match(/\[\[([^\]]+)\]\]/);
	return match ? match[1] : null;
}

function getIPAIndexes(str: string) {
	const regex = /\[(?!\[)(.*?)(?<!\])\]/g;
	const matches: [number, number][] = [];
	let match;

	while ((match = regex.exec(str)) !== null) {
		if (match.index === 0 || str[match.index - 1] !== "[") {
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
	baseBlock: string,
): Promise<string> {
	try {
		let clipboardContent = "";
		if (typeof navigator !== "undefined" && navigator.clipboard) {
			clipboardContent = await navigator.clipboard.readText();
		}
		const [first, ...rest] = baseBlock.split("---");

		if (rest.length >= 1) {
			// Insert clipboard content between the first two dividers
			return (
				first +
				"---\n" +
				clipboardContent.trim() +
				rest.map((a) => a.trim()).join("\n\n---\n") +
				"\n"
			);
		}

		return baseBlock;
	} catch (error) {
		console.error("Failed to read clipboard:", error);
		return baseBlock;
	}
}
