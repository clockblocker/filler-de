import { describe, it, expect } from 'bun:test';

import {
	extractMetaInfo,
	editOrAddMetaInfo,
} from '../../src/pure-formatters/meta-info-manager/interface';
import { PAGE, NOTE } from '../../src/types/beta/literals';

describe('meta-info manager', () => {
	describe('extractMetaInfo', () => {
		it('returns parsed MetaInfo when a valid meta section exists', () => {
			const input = `Hello\n<section id={textfresser_meta_keep_me_invisible}>\n{"fileType":"Page"}\n</section>\nWorld`;

			const result = extractMetaInfo(input);

			expect(result).toEqual({ fileType: PAGE });
		});

		it('returns null when no meta section is present', () => {
			const input = 'No special section here';
			const result = extractMetaInfo(input);
			expect(result).toBeNull();
		});

		it('returns null when JSON parses but schema fails', () => {
			const input = `<section id={textfresser_meta_keep_me_invisible}>\n{"fileType":"Unknown"}\n</section>`;
			const result = extractMetaInfo(input);
			expect(result).toBeNull();
		});
	});

	describe('editOrAddMetaInfo', () => {
		it('replaces existing meta section content', () => {
			const original = `Start\n<section id={textfresser_meta_keep_me_invisible}>\n{"fileType":"Page"}\n</section>\nEnd`;
			const updated = editOrAddMetaInfo(original, { fileType: NOTE });

			// Expect the meta block to be replaced (not duplicated) and updated
			expect(updated).toContain(
				`<section id={textfresser_meta_keep_me_invisible}>`
			);
			expect(updated).toContain(`{"fileType":"Note"}`);

			const afterExtract = extractMetaInfo(updated);
			expect(afterExtract).toEqual({ fileType: NOTE });
		});

		it('appends a new meta section when none exists', () => {
			const original = 'Just some content';
			const updated = editOrAddMetaInfo(original, { fileType: PAGE });

			// Should append a line break then the section
			expect(updated.startsWith(original)).toBe(true);
			expect(updated).toContain(
				`<section id={textfresser_meta_keep_me_invisible}>`
			);
			expect(updated).toContain(`{"fileType":"Page"}`);

			const afterExtract = extractMetaInfo(updated);
			expect(afterExtract).toEqual({ fileType: PAGE });
		});
	});
});
