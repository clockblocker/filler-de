import { describe, expect, it } from 'bun:test';

import {
	editOrAddMetaInfo,
	extractMetaInfo,
} from '../../../src/managers/pure/meta-info-manager/interface';
import { TextStatusLegacy } from '../../../src/types/common-interface/enums';
import { PAGE } from '../../../src/types/literals';

describe('meta-info manager', () => {
	describe('extractMetaInfo', () => {
		it('returns parsed MetaInfo when a valid meta section exists', () => {
			const input = `Hello\n<section id={textfresser_meta_keep_me_invisible}>\n{"fileType":"Scroll", "status":"NotStarted"}\n</section>\nWorld`;
			const result = extractMetaInfo(input);

			expect(result).toEqual({ fileType: 'Scroll', status: TextStatusLegacy.NotStarted });
		});

		it('returns null when no meta section is present', () => {
			const input = 'No special section here';
			const result = extractMetaInfo(input);
			expect(result).toBeNull();
		});
	});

	describe('editOrAddMetaInfo', () => {
		it('handles index > 999 by failing validation', () => {
			const input = `Hello\n<section id={textfresser_meta_keep_me_invisible}>\n{"fileType":"Page", "index":1000, "status":"NotStarted"}\n</section>\nWorld`;
			
			// extractMetaInfo should return null when index > 999 (validation fails)
			const result = extractMetaInfo(input);
			expect(result).toBeNull();
		});


		it('handles negative index by failing validation', () => {
			const input = `Hello\n<section id={textfresser_meta_keep_me_invisible}>\n{"fileType":"Page", "index":-1, "status":"NotStarted"}\n</section>\nWorld`;
			
			// extractMetaInfo should return null when index < 0 (validation fails)
			const result = extractMetaInfo(input);
			expect(result).toBeNull();
		});
	});
});
