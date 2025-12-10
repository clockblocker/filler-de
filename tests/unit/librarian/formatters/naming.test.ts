import { describe, expect, it } from 'bun:test';
import {
	toNodeName,
	treePathToCodexBasename,
	treePathToPageBasename,
} from '../../../../src/commanders/librarian/indexing/codecs';
import { DASH } from '../../../../src/types/literals';

describe('toNodeName', () => {
	it('replaces all "space like" characters with underscores', () => {
		expect(toNodeName('foo bar\tbaz')).toBe('foo_bar_baz');
		expect(toNodeName('foo\u2003baz')).toBe('foo_baz');
		expect(toNodeName('foo\nbar')).toBe('foo_bar');
		expect(toNodeName('foo\u00A0bar')).toBe('foo_bar');
	});

	it('Removes forbidden characters', () => {
		expect(toNodeName('x/y*z|||/|\\:')).toBe('xy*z');
	});

	it('handles repeated spaces', () => {
		expect(toNodeName('a  b   c')).toBe('a_b_c');
	});
});

describe('treePathToCodexBasename', () => {
	it('single node in path', () => {
		expect(treePathToCodexBasename.encode(['foo'])).toBe('__foo');
		expect(treePathToCodexBasename.decode('__foo')).toEqual(['foo']);
	});

	it('two nodes in path', () => {
		expect(treePathToCodexBasename.encode(['bar', 'foo'])).toBe(`__foo${DASH}bar`);
		expect(treePathToCodexBasename.decode(`__foo${DASH}bar`)).toEqual(['bar', 'foo']);
	});
});

describe('treePathToPageBasename', () => {
	it('2 nodes', () => {
		expect(treePathToPageBasename.encode(['Avatar', '010'])).toBe(`010${DASH}Avatar`);
		expect(treePathToPageBasename.decode(`010${DASH}Avatar`)).toEqual(['Avatar', '010']);
	});

	it('4 nodes', () => {
		expect(treePathToPageBasename.encode(['Avatar', 'Season_1', 'Episode_1', '001'])).toBe(`001${DASH}Episode_1${DASH}Season_1${DASH}Avatar`);
		expect(treePathToPageBasename.decode(`001${DASH}Episode_1${DASH}Season_1${DASH}Avatar`)).toEqual(['Avatar', 'Season_1', 'Episode_1', '001']);
	});
});