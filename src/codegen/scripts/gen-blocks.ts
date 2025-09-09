// src/codegen/scripts/gen-blocks.ts
import { BLOCK_NAMES } from 'codegen/consts-for-codegen';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'fs';
import { dirname } from 'path';

const OUT_TS = '.src/codegen/generated/block-classes.ts';
const OUT_CSS = 'styles.css';

// Anchors in styles.css
const ANCHOR_START = '/* <AUTO:BLOCKS START> */';
const ANCHOR_END = '/* <AUTO:BLOCKS END> */';

function ensureDir(path: string) {
	mkdirSync(dirname(path), { recursive: true });
}

// --- TS generation (no prettier here) ---
function genTs(): string {
	const IND = '\t';
	const lines: string[] = [];
	lines.push('// AUTO-GENERATED FILE. Do not edit by hand.');
	lines.push("export const NOTE_BLOCK_CLASS = 'note_block';");
	lines.push("export const NOTE_BLOCK_PREFIX = 'note_block_';");
	lines.push('');
	lines.push('export const BLOCK_CLASSES = {');
	for (const name of BLOCK_NAMES) {
		lines.push(
			`${IND}${name}: \`\${NOTE_BLOCK_CLASS} \${NOTE_BLOCK_PREFIX}${name}\`,`
		);
	}
	lines.push('} as const;');
	lines.push('');
	return lines.join('\n');
}

// --- CSS block generation (no prettier here) ---
function genCssBlock(): string {
	const IND = '\t';
	const chunks: string[] = [];
	chunks.push(ANCHOR_START);
	chunks.push('');
	for (const name of BLOCK_NAMES) {
		chunks.push(
			[
				`span.note_block.note_block_${name} {`,
				`${IND}/* styles for ${name} */`,
				`}`,
			].join('\n')
		);
		chunks.push(''); // blank line between blocks
	}
	chunks.push(ANCHOR_END);
	chunks.push(''); // trailing newline
	return chunks.join('\n');
}

// Replace (or insert) the anchored section in styles.css
function writeCssWithAnchors(cssPath: string, generatedSection: string) {
	let base = '';
	if (existsSync(cssPath)) {
		base = readFileSync(cssPath, 'utf8');
	} else {
		// create minimal file with anchors if none exists
		base = ['/* Plugin styles */', '', ANCHOR_START, '', ANCHOR_END, ''].join(
			'\n'
		);
	}

	const startIdx = base.indexOf(ANCHOR_START);
	const endIdx = base.indexOf(ANCHOR_END);

	if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
		const before = base.slice(0, startIdx);
		const after = base.slice(endIdx + ANCHOR_END.length);
		// Ensure surrounding newlines look sane
		const finalCss =
			before.replace(/\s*$/, '\n') + // trim trailing whitespace, add one newline
			generatedSection +
			(after.startsWith('\n') ? after : '\n' + after);
		writeFileSync(cssPath, finalCss, 'utf8');
	} else {
		// Anchors missing or malformed: append generated block at end with anchors
		const needsNL = base.endsWith('\n') ? '' : '\n';
		writeFileSync(cssPath, base + needsNL + generatedSection, 'utf8');
	}
}

function prependFile(path: string, content: string) {
	let existing = '';
	if (existsSync(path)) {
		existing = readFileSync(path, 'utf8');
	}
	writeFileSync(path, content + '\n' + existing, 'utf8');
}

function main() {
	// TS out
	ensureDir(OUT_TS);
	prependFile(OUT_TS, genTs());
	console.log(`✅ Wrote ${OUT_TS}`);

	// CSS out (replace between anchors)
	const cssBlock = genCssBlock();
	writeCssWithAnchors(OUT_CSS, cssBlock);
	console.log(`✅ Updated ${OUT_CSS} (between anchors)`);
}

main();
