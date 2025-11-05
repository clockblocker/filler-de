import { describe, expect, it } from 'bun:test';
import { CodexNameFromTreePath, PageNameFromTreePath, toGuardedNodeName } from '../../../src/commanders/librarian/formatters';
import { DASH } from '../../../src/types/literals';


describe('toGuardedNodeName', () => {
	it('replaces all "space like" characters with underscores', () => {
		expect(toGuardedNodeName('foo bar\tbaz')).toBe('foo_bar_baz');
		expect(toGuardedNodeName('foo\u2003baz')).toBe('foo_baz');
		expect(toGuardedNodeName('foo\nbar')).toBe('foo_bar');
		expect(toGuardedNodeName('foo\u00A0bar')).toBe('foo_bar');
	});

	it('preserves all other characters', () => {
		expect(toGuardedNodeName('x/y*z')).toBe('x/y*z');
	});

	it('handles repeated spaces', () => {
		expect(toGuardedNodeName('a  b   c')).toBe('a_b_c');
	});
});

describe('CodexNameFromTreePath', () => {
	it('single node in path', () => {
		expect(CodexNameFromTreePath.encode(['foo'])).toBe('__foo');
		expect(CodexNameFromTreePath.decode('__foo')).toEqual(['foo']);
	});

	it('two nodes in path', () => {
		expect(CodexNameFromTreePath.encode(['foo', 'bar'])).toBe(`__foo${DASH}bar`);
		expect(CodexNameFromTreePath.decode(`__foo${DASH}bar`)).toEqual(['foo', 'bar']);
	});
});


describe('PageNameFromTreePath', () => {
	it('2 nodes', () => {
		expect(PageNameFromTreePath.encode(['Avatar', '10'])).toBe(`010${DASH}Avatar`);
		expect(PageNameFromTreePath.decode(`010${DASH}Avatar`)).toEqual(['Avatar', '10']);
	});

	it('4 nodes', () => {
		expect(PageNameFromTreePath.encode(['Avatar', 'Season_1', 'Episode_1', '1'])).toBe(`001${DASH}Avatar${DASH}Season_1${DASH}Episode_1`);
		expect(PageNameFromTreePath.decode(`001${DASH}Avatar${DASH}Season_1${DASH}Episode_1`)).toEqual(['Avatar', 'Season_1', 'Episode_1', '1']);
	});
});