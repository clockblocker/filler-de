import { expect } from "bun:test";
import {
	createFile,
	deletePath,
	fileExists,
	listFiles,
	readFile,
} from "../utils";
import { obsidianEval } from "../utils/cli";

export const SOURCE_PATH = "Outside/Textfresser-P0-Stabilization.md";

export const SCENARIOS = {
	A1_A: "klar",
	A1_B: "deutlich",
	N2_A: "Mann",
	N3_B: "Katze",
	P1_A: "auf",
	V1_A: "fängt",
} as const;

const SOURCE_CONTENT = [
	"Der Mann liest heute ein Buch. ^n2a",
	"Die Katze schläft dort. ^n3b",
	"Er fängt morgen früh an. ^v1a",
	"Das machen wir auf jeden Fall zusammen. ^p1a",
	"Der Plan wirkt klar. ^a1a",
	"Der Ablauf bleibt deutlich. ^a1b",
].join("\n");

const WIKILINK_REGEX = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;

export async function prepareSourceFile(): Promise<void> {
	await deletePath(SOURCE_PATH);
	await createFile(SOURCE_PATH, SOURCE_CONTENT);
}

export async function installTextfresserE2EStubs(): Promise<void> {
	const code = `(async()=>{const plugin=app.plugins.plugins['cbcr-text-eater-de'];if(!plugin||!plugin.textfresser){throw new Error('Textfresser plugin not available')}const tf=plugin.textfresser;const state=tf.getState();state.promptRunner.generate=(kind,input)=>{if(kind==='Lemma'){const surface=(input&&typeof input==='object'&&'surface' in input&&typeof input.surface==='string')?input.surface:'';return Promise.resolve({isErr:()=>false,isOk:()=>true,value:{lemma:surface.toLowerCase(),linguisticUnit:'Lexem',posLikeKind:'Noun',surfaceKind:'Lemma'}})}if(kind==='Disambiguate'){return Promise.resolve({isErr:()=>false,isOk:()=>true,value:{matchedIndex:null}})}return Promise.resolve({isErr:()=>false,isOk:()=>true,value:{matchedIndex:null}})};const ensureFolders=async(path)=>{const parts=path.split('/');let curr='';for(let i=0;i<parts.length-1;i++){curr=curr?curr+'/'+parts[i]:parts[i];if(!curr)continue;try{await app.vault.createFolder(curr)}catch{}}};const toPath=(splitPath)=>[...splitPath.pathParts,splitPath.basename+'.'+splitPath.extension].join('/');tf.runBackgroundGenerate=async(targetPath,lemma,notify)=>{const path=toPath(targetPath);await ensureFolders(path);await new Promise((resolve)=>setTimeout(resolve,300));const file=app.vault.getAbstractFileByPath(path);const payload='---\\nnoteKind: \"DictEntry\"\\n---\\n\\n<span class=\"entry_section_title\">stub</span>\\n'+lemma;if(file){await app.vault.modify(file,payload)}else{await app.vault.create(path,payload)}if(typeof notify==='function'){notify('✓ Entry created for '+lemma)}};return 'ok'})()`;
	await obsidianEval(code, 20_000);
}

export async function runLemma(surface: string): Promise<void> {
	const surfaceEscaped = surface
		.replace(/\\/g, "\\\\")
		.replace(/'/g, "\\'")
		.replace(/\n/g, "\\n")
		.replace(/\r/g, "\\r");
	const pathEscaped = SOURCE_PATH.replace(/\\/g, "\\\\").replace(/'/g, "\\'");

	const code = `(async()=>{const plugin=app.plugins.plugins['cbcr-text-eater-de'];if(!plugin||!plugin.textfresser){throw new Error('Textfresser plugin not available')}const toSplitPath=(path)=>{const parts=path.split('/');const fileName=parts.pop();if(!fileName){throw new Error('Invalid file path: '+path)}const dot=fileName.lastIndexOf('.');if(dot===-1){throw new Error('File without extension: '+fileName)}return {basename:fileName.slice(0,dot),extension:fileName.slice(dot+1),kind:'MdFile',pathParts:parts}};const splitPath=toSplitPath('${pathEscaped}');const file=app.vault.getAbstractFileByPath('${pathEscaped}');if(!file){throw new Error('File not found: ${pathEscaped}')}const content=await app.vault.read(file);const surface='${surfaceEscaped}';const start=content.indexOf(surface);if(start===-1){throw new Error('Selected text not found: '+surface)}const lines=content.split('\\n');let lineStart=0;let surroundingRawBlock=null;for(const line of lines){const lineEnd=lineStart+line.length;if(start>=lineStart&&start<=lineEnd){surroundingRawBlock=line;break}lineStart=lineEnd+1}if(surroundingRawBlock===null){throw new Error('Could not resolve surrounding block')}const result=await plugin.textfresser.executeCommand('Lemma',{activeFile:{content,splitPath},selection:{selectionStartInBlock:start-lineStart,splitPathToFileWithSelection:splitPath,surroundingRawBlock,text:surface}},()=>{});if(result.isErr&&result.isErr()){const error=result.error;const reason=error&&typeof error==='object'&&'reason' in error?error.reason:'';throw new Error('Lemma failed: '+String(error.kind??'unknown')+(reason?': '+String(reason):''))}return 'ok'})()`;

	await obsidianEval(code, 20_000);
}

export function assertNoNestedWikilinks(content: string): void {
	expect(content).not.toMatch(/\[\[[^\]]*\[\[/);
}

export function assertSurfaceLinked(content: string, surface: string): void {
	const pattern = new RegExp(
		`\\[\\[(?:[^\\]|]+\\|)?${surface.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\]\\]`,
	);
	expect(content).toMatch(pattern);
}

export function findTargetForSurface(
	content: string,
	surface: string,
): string | null {
	for (const match of content.matchAll(WIKILINK_REGEX)) {
		const target = match[1];
		const alias = match[2];
		if (!target) {
			continue;
		}

		if (alias === surface || (alias === undefined && target === surface)) {
			return target;
		}
	}

	return null;
}

export async function resolveTargetMdPath(linkTarget: string): Promise<string> {
	const directCandidate = linkTarget.endsWith(".md")
		? linkTarget
		: `${linkTarget}.md`;
	if (await fileExists(directCandidate)) {
		return directCandidate;
	}

	const basenameCandidate = directCandidate.split("/").pop();
	if (!basenameCandidate) {
		throw new Error(`Invalid link target: ${linkTarget}`);
	}

	const allMdFiles = await listFiles(undefined, "md");
	const matches = allMdFiles.filter((path) =>
		path.endsWith(`/${basenameCandidate}`) || path === basenameCandidate,
	);
	if (matches.length === 1) {
		const match = matches[0];
		if (!match) {
			throw new Error(
				`Unexpected empty match while resolving target: ${linkTarget}`,
			);
		}
		return match;
	}

	throw new Error(
		`Could not uniquely resolve link target "${linkTarget}". Candidates: ${matches.join(", ")}`,
	);
}

export async function readSourceFile(): Promise<string> {
	return readFile(SOURCE_PATH);
}
