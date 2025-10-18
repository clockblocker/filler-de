import { describe, it, expect } from 'bun:test';

import { CurratedTree } from '../../src/currator/currated-tree';
import { DEFINED_BRANCHES } from './static/defined-branches';

describe('texts -> nodes', () => {
	it('should deserialize texts into nodes', () => {
		for (const [__name, branch] of Object.entries(DEFINED_BRANCHES)) {
			const { nodes, texts } = branch;
			const tree = new CurratedTree([], 'Library');
			texts.forEach((text) => {
				tree.addText(text);
			});

			expect(nodes).toEqual(tree.children);
		}
	});
});
