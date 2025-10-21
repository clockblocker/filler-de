import { describe, expect, it } from 'bun:test';
import { toGuardedNodeName } from '../../../src/managers/currator/pure-functions/naming';

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
		expect(toGuardedNodeName('a  b   c')).toBe('a__b___c');
	});
});
