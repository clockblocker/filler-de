import { describe, expect, it } from 'bun:test';

import {
	editOrAddMetaInfo,
	extractMetaInfo,
} from '../../src/services/dto-services/meta-info-manager/interface';
import { TextStatus } from '../../src/types/common-interface/enums';
import { PAGE } from '../../src/types/literals';

describe('meta-info manager', () => {
	describe('extractMetaInfo', () => {
		it('returns parsed MetaInfo when a valid meta section exists', () => {
			const input = `Hello\n<section id={textfresser_meta_keep_me_invisible}>\n{"fileType":"Page", "status":"NotStarted"}\n</section>\nWorld`;

			const result = extractMetaInfo(input);

			expect(result).toEqual({ fileType: PAGE, status: TextStatus.NotStarted });
		});

		it('returns null when no meta section is present', () => {
			const input = 'No special section here';
			const result = extractMetaInfo(input);
			expect(result).toEqual({ fileType: 'Unknown' });
		});
	});

	describe('editOrAddMetaInfo', () => {
		it('replaces existing meta section content', () => {
			const original = `Start\n<section id={textfresser_meta_keep_me_invisible}>\n{"fileType":"Page", "status":"NotStarted"}\n</section>\nEnd`;
			const updated = editOrAddMetaInfo(original, { fileType: PAGE, status: TextStatus.NotStarted });

			// Expect the meta block to be replaced (not duplicated) and updated
			expect(updated).toContain(
				`<section id={textfresser_meta_keep_me_invisible}>`
			);
			expect(updated).toContain(`{"fileType":"Page","status":"NotStarted"}`);

			const afterExtract = extractMetaInfo(updated);
			expect(afterExtract).toEqual({ fileType: PAGE, status: TextStatus.NotStarted });
		});

		it('appends a new meta section when none exists', () => {
			const original = 'Just some content';
			const updated = editOrAddMetaInfo(original, { fileType: PAGE, status: TextStatus.NotStarted });

			// Should append a line break then the section
			expect(updated.startsWith(original)).toBe(true);
			expect(updated).toContain(
				`<section id={textfresser_meta_keep_me_invisible}>`
			);
			expect(updated).toContain(`{"fileType":"Page","status":"NotStarted"}`);

			const afterExtract = extractMetaInfo(updated);
			expect(afterExtract).toEqual({ fileType: PAGE, status: TextStatus.NotStarted });
		});
	});
});
