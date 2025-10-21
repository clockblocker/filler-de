import { describe, expect, it } from 'bun:test';
import { codexChaptersToMarkdown } from '../../src/services/pure-formatters/codex-manager/formatters/codex-deserialiser';
import { markdownToChapterItems } from '../../src/services/pure-formatters/codex-manager/formatters/codex-serializer';
import type { CodexChapter } from '../../src/services/pure-formatters/codex-manager/types';

const jsonRoundtripTests = [
	[
		{ pathParts: ['Texts', 'Series', 'Extra'], title: 'S1 E1', done: true },
		{ pathParts: ['Texts', 'Series', 'Extra'], title: 'S1 E2', done: false },
		{
			pathParts: ['Texts', 'Songs', 'Rammstein'],
			title: 'Sonne',
			done: false,
		},
		{
			pathParts: ['Texts', 'Songs', 'Rammstein'],
			title: 'Mann gegen mann',
			done: false,
		},
		{ pathParts: ['Texts', 'Songs'], title: 'Song 1', done: true },
		{ pathParts: ['Texts'], title: 'Flat 1', done: false },
		{ pathParts: ['Texts'], title: 'Flat 2', done: true },
	],
];

const mdRoundtripTests = [
	`- **Texts**
        * [ ] [[Flat 1-index|Flat 1]]
        * [x] [[Flat 2-index|Flat 2]]
        * **Series**
                * **Extra**
                        * [x] [[S1 E1-index|S1 E1]]
                        * [ ] [[S1 E2-index|S1 E2]]
        * **Songs**
                * [x] [[Song 1-index|Song 1]]
                * **Rammstein**
                        * [ ] [[Mann gegen mann-index|Mann gegen mann]]
                        * [ ] [[Sonne-index|Sonne]]`,
	`- **Texts**
* [ ] [[Flat 1-index|Flat 1]]
* [x] [[Flat 2-index|Flat 2]]
        * **Series**	
         
	* **Extra**
                       [x] [[S1 E1-index|S1 E1]]
                        * [ ] [[S1 E2-index|S1 E2]]
        * #### **Songs**
                * [x] [[Song 1-index|Song 1]]
			* **Rammstein**
					* [ ] [[Mann gegen mann-index|Mann gegen mann]]
                        
					 
					   * [ ] [[Sonne-index|Sonne]]`,
];

function sortItems(arr: CodexChapter[]) {
	return arr.slice().sort((a, b) => {
		const pathA = a.pathParts.join('/') + '/' + a.title;
		const pathB = b.pathParts.join('/') + '/' + b.title;
		return pathA.localeCompare(pathB) || Number(a.done) - Number(b.done);
	});
}

describe('chapterItemsToMarkdown / markdownToChapterItems roundtrip', () => {
	it('should roundtrip a complex chapter structure', () => {
		for (const items of jsonRoundtripTests) {
			const md = codexChaptersToMarkdown(items);
			const parsed = markdownToChapterItems(md);
			expect(sortItems(parsed)).toEqual(sortItems(items));
		}
	});
});

describe('markdownToChapterItems / chapterItemsToMarkdown roundtrip', () => {
	it('should roundtrip a complex chapter structure', () => {
		for (const md of mdRoundtripTests) {
			const items = markdownToChapterItems(md);

			const md2 = codexChaptersToMarkdown(items);
			const parsed = markdownToChapterItems(md2);

			expect(sortItems(parsed)).toEqual(sortItems(items));
		}
	});
});
