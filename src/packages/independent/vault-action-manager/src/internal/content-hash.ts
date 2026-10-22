/**
 * A fast, non-cryptographic hash of a file's content (cyrb53 over UTF-16
 * code units, two seeds) with its length. Dispatch reports name the content
 * an action read and left with it, so a caller can tell whether a file
 * still holds what VAM wrote.
 */
export function vaultContentHash(content: string): string {
	return `${content.length.toString(36)}-${cyrb53(content, 0)}${cyrb53(content, 0x9e3779b9)}`;
}

function cyrb53(text: string, seed: number): string {
	let h1 = 0xdeadbeef ^ seed;
	let h2 = 0x41c6ce57 ^ seed;
	for (let index = 0; index < text.length; index++) {
		const code = text.charCodeAt(index);
		h1 = Math.imul(h1 ^ code, 2654435761);
		h2 = Math.imul(h2 ^ code, 1597334677);
	}
	h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
	h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
	h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
	h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
	const value = 4294967296 * (2097151 & h2) + (h1 >>> 0);
	return value.toString(16).padStart(14, "0");
}
