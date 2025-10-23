import { describe, expect, it } from 'bun:test';
import { CodexNameFromTreePath, PageNameFromTreePath, toGuardedNodeName } from '../../../src/managers/librarian/formatters';
import { NON_BREAKING_HYPHEN } from '../../../src/types/literals';


describe('toGuardedNodeName', () => {
	it('replaces non-breaking hyphen with dash', () => {
		expect(toGuardedNodeName('foo‑bar')).toBe('foo—bar');
	});

	it('replaces all "space like" characters with underscores', () => {
		expect(toGuardedNodeName('foo bar\tbaz')).toBe('foo_bar_baz');
		expect(toGuardedNodeName('foo\u2003baz')).toBe('foo_baz');
		expect(toGuardedNodeName('foo\nbar')).toBe('foo_bar');
		expect(toGuardedNodeName('foo\u00A0bar')).toBe('foo_bar');
	});

	it('does both, including grouping', () => {
		expect(toGuardedNodeName('A‑B C\tD')).toBe('A—B_C_D');
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
		expect(CodexNameFromTreePath.encode(['foo', 'bar'])).toBe(`__foo${NON_BREAKING_HYPHEN}bar`);
		expect(CodexNameFromTreePath.decode(`__foo${NON_BREAKING_HYPHEN}bar`)).toEqual(['foo', 'bar']);
	});
});


describe('PageNameFromTreePath', () => {
	it('2 nodes', () => {
		expect(PageNameFromTreePath.encode(['Avatar', '10'])).toBe(`010${NON_BREAKING_HYPHEN}Avatar`);
		expect(PageNameFromTreePath.decode(`010${NON_BREAKING_HYPHEN}Avatar`)).toEqual(['Avatar', '10']);
	});

	it('4 nodes', () => {
		expect(PageNameFromTreePath.encode(['Avatar', 'Season_1', 'Episode_1', '1'])).toBe(`001${NON_BREAKING_HYPHEN}Avatar${NON_BREAKING_HYPHEN}Season_1${NON_BREAKING_HYPHEN}Episode_1`);
		expect(PageNameFromTreePath.decode(`001${NON_BREAKING_HYPHEN}Avatar${NON_BREAKING_HYPHEN}Season_1${NON_BREAKING_HYPHEN}Episode_1`)).toEqual(['Avatar', 'Season_1', 'Episode_1', '1']);
	});
});