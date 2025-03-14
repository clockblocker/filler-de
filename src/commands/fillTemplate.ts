import { Editor, MarkdownView, Notice, TFile } from 'obsidian';
import TextEaterPlugin from '../main';
import { prompts } from 'prompts';
import { longDash } from 'utils';

function extractFirstBracketedWord(text: string) {
    const match = text.match(/\[\[([^\]]+)\]\]/);
    return match ? match[1] : null;
}

function getIPAIndexes(str: string) {
    const regex = /(?<!\[)\[(?!\[)(.*?)(?<!\])\](?!\])/g;
    let matches = [];
    let match;
    
    while ((match = regex.exec(str)) !== null) {
        matches.push([match.index, regex.lastIndex - 1]);
    }
    
    return matches.length ? matches[0] : null;
}

function incertYouglishLinkInIpa(baseBlock: string) {
    const ipaI = getIPAIndexes(baseBlock);
    const word = extractFirstBracketedWord(baseBlock);

    if (!ipaI || !word) {
        return baseBlock;
    }
    
    return baseBlock.slice(0, ipaI[1] + 1) + `(https://youglish.com/pronounce/${word}/german)` + baseBlock.slice(ipaI[1] + 1);
}

export default async function fillTemplate(plugin: TextEaterPlugin, editor: Editor, file: TFile, callBack?: () => void) {
    const word = file.basename;

    try {
        const [dictionaryEntry, froms, morphems, valence] = await Promise.all([
            plugin.apiService.generateContent(prompts.generate_dictionary_entry, word),
            plugin.apiService.generateContent(prompts.generate_forms, word),
            plugin.apiService.generateContent(prompts.morphems, word),
            plugin.apiService.generateContent(prompts.generate_valence_block, word)
        ]);
        
        const adjForms = extractAdjectiveForms(froms);

        const baseBlock = `${dictionaryEntry.replace('<agent_output>', '').replace('</agent_output>', '')}`;
        const morphemsBlock = morphems.replace('\n', "") === longDash ? "" : `${morphems}\n`;
        const valenceBlock = valence.replace('\n', "") === longDash ? "" : `${valence}`;
        const fromsBlock = froms.replace('\n', "") === longDash ? "" : `${froms}`;
        const adjFormsBlock = adjForms.replace('\n', "") === longDash ? "" : `${adjForms}`;

        const blocks = [incertYouglishLinkInIpa(baseBlock), morphemsBlock, valenceBlock, fromsBlock, adjFormsBlock];
        const entrie = blocks.filter(Boolean).join('\n---\n')
        
        const normalForm = extractFirstBracketedWord(baseBlock);

        if (normalForm?.toLocaleLowerCase() === word.toLocaleLowerCase()) {
            await plugin.fileService.appendToFile(file.path, entrie);
        } else {
            await plugin.fileService.appendToFile(file.path, `[[${normalForm}]]`);
        }
    } catch (error) {
        new Notice(`Error: ${error.message}`);
    }
} 

function extractBaseForms(text: string): string[] | null {
    const match = text.match(/Adjektive:\s*\[\[(.*?)\]\],\s*\[\[(.*?)\]\],\s*\[\[(.*?)\]\]/);
    if (!match) {
        return null;
    }
    
    let [_, base, comparative, superlative] = match;
    
    return [base, comparative, superlative];
    
}


function extractAdjectiveForms(text: string): string {
    const baseForms = extractBaseForms(text);

    if (!baseForms) {
        return longDash;
    }
 
    const endings = ["er", "es", "e", "en", "em"];
    
    const result: string[] = [];
    
    for (const suf of baseForms) {
        for (const end of endings) {
            result.push(`[[${suf + end}]]`);
        }
    }
    
    return result.join(', ');
}