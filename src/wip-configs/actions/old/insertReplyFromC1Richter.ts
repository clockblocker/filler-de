// import { Editor } from 'obsidian';
// import TextEaterPlugin from '../../main';
// import { cleanMarkdownFormatting } from './functions';

// export default async function insertReplyFromC1Richter(
// 	plugin: TextEaterPlugin,
// 	editor: Editor,
// 	selection: string
// ) {
// 	try {
// 		const response = await plugin.apiService.consultC1Richter(
// 			cleanMarkdownFormatting(selection)
// 		);
// 		if (response) {
// 			editor.replaceSelection(selection + '\n' + response.trim());
// 		}
// 	} catch (error) {
// 		console.error('Error in C1 Richter command:', error);
// 	}
// }
