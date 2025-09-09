// scripts/gen-blocks.ts
import { BLOCK_NAMES } from 'codegen/consts';
import { writeFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';

const outTs = 'src/codegen/generated/block-classes.ts';
const outCss = 'styles/generated-blocks.css';

// ensure parent folders exist
mkdirSync(dirname(outTs), { recursive: true });
mkdirSync(dirname(outCss), { recursive: true });

const tsOut: string[] = [];
const cssOut: string[] = [];

tsOut.push(`// AUTO-GENERATED FILE. Do not edit by hand.`);
tsOut.push(`export const NOTE_BLOCK_CLASS = "note_block";`);
tsOut.push(`export const NOTE_BLOCK_PREFIX = "note_block_";`);
tsOut.push(`\nexport const BLOCK_CLASSES = {`);

for (const name of BLOCK_NAMES) {
	tsOut.push(
		`  ${name}: \`\${NOTE_BLOCK_CLASS} \${NOTE_BLOCK_PREFIX}${name}\`,`
	);
	cssOut.push(
		`span.note_block.note_block_${name} {\n  /* styles for ${name} */\n}`
	);
}

tsOut.push(`} as const;\n`);

writeFileSync(outTs, tsOut.join('\n'), 'utf8');
writeFileSync(outCss, cssOut.join('\n\n'), 'utf8');

console.log(`✅ Generated ${outTs} and ${outCss}`);
