import { describe, expect, it } from 'bun:test';
import { codexNameFromTreePath, pageNameFromTreePath, toGuardedNodeName } from '../../../src/commanders/librarian/indexing/codecs';
import { DASH, PAGE } from '../../../src/types/literals';


describe('toGuardedNodeName', () => {
	it('replaces all "space like" characters with underscores', () => {
		expect(toGuardedNodeName('foo bar\tbaz')).toBe('foo_bar_baz');
		expect(toGuardedNodeName('foo\u2003baz')).toBe('foo_baz');
		expect(toGuardedNodeName('foo\nbar')).toBe('foo_bar');
		expect(toGuardedNodeName('foo\u00A0bar')).toBe('foo_bar');
	});

	it('Removes forbidden characters', () => {
		expect(toGuardedNodeName('x/y*z|||/|\\:')).toBe('xy*z');
	});

	it('handles repeated spaces', () => {
		expect(toGuardedNodeName('a  b   c')).toBe('a_b_c');
	});
});

describe('CodexNameFromTreePath', () => {
	it('single node in path', () => {
		expect(codexNameFromTreePath.encode(['foo'])).toBe('__foo');
		expect(codexNameFromTreePath.decode('__foo')).toEqual(['foo']);
	});

	it('two nodes in path', () => {
		expect(codexNameFromTreePath.encode([ 'bar', 'foo'])).toBe(`__foo${DASH}bar`);
		expect(codexNameFromTreePath.decode(`__foo${DASH}bar`)).toEqual(['bar', 'foo']);
	});
});


describe('PageNameFromTreePath', () => {
	it('2 nodes', () => {
		expect(pageNameFromTreePath.encode(['Avatar', '010'])).toBe(`010${DASH}Avatar`);
		expect(pageNameFromTreePath.decode(`010${DASH}Avatar`)).toEqual(['Avatar', '010']);
	});

	it('4 nodes', () => {
		expect(pageNameFromTreePath.encode(['Avatar', 'Season_1', 'Episode_1', '001'])).toBe(`001${DASH}Episode_1${DASH}Season_1${DASH}Avatar`);
		expect(pageNameFromTreePath.decode(`001${DASH}Episode_1${DASH}Season_1${DASH}Avatar`)).toEqual(['Avatar', 'Season_1', 'Episode_1', '001']);
	});
});