import { describe, it, expect } from 'bun:test';

import { CurratedTree } from '../../src/currator/currated-tree';
import { DEFINED_BRANCHES } from './static/defined-branches';
import { logToFile } from '../tracing/functions/write-log-to-file';

describe.only('texts -> nodes', () => {
	it('should deserialize texts into nodes', () => {
		for (const [__name, branch] of Object.entries(DEFINED_BRANCHES)) {
			const { nodes, texts } = branch;
			const tree = new CurratedTree([], 'Library');
			texts.forEach((text) => {
				tree.addText(text);
			});

			const otherTree = new CurratedTree(nodes, 'Library');

			// logToFile(
			// 	`${__name}-tree-children.json`,
			// 	JSON.stringify(tree.children, null, 2)
			// );
			// logToFile(
			// 	`${__name}-other-tree-children.json`,
			// 	JSON.stringify(otherTree.children, null, 2)
			// );

			const diff = tree.getDiff(otherTree);
			// logToFile(`${__name}-diff.json`, JSON.stringify(diff, null, 2));

			expect(diff).toEqual([]);
		}
	});
});
