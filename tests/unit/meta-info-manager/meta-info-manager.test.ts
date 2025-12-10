import { describe, expect, it } from 'bun:test';

import {
	editOrAddMetaInfo,
	extractMetaInfo,
} from '../../../src/services/dto-services/meta-info-manager/interface';
import { TextStatus } from '../../../src/types/common-interface/enums';
import { PAGE } from '../../../src/types/literals';

describe('meta-info manager', () => {
	describe('extractMetaInfo', () => {
		it('returns parsed MetaInfo when a valid meta section exists', () => {
			const input = `Hello\n<section id={textfresser_meta_keep_me_invisible}>\n{"fileType":"Page", "index":11, "status":"NotStarted"}\n</section>\nWorld`;
			const result = extractMetaInfo(input);

			expect(result).toEqual({ fileType: PAGE, index: 11, status: TextStatus.NotStarted });
		});

		it('returns null when no meta section is present', () => {
			const input = 'No special section here';
			const result = extractMetaInfo(input);
			expect(result).toBeNull();
		});
	});

	describe('editOrAddMetaInfo', () => {
		it('replaces existing meta section content', () => {
			const original = `Start\n<section id={textfresser_meta_keep_me_invisible}>\n{"fileType":"Page", "index":5, "status":"NotStarted"}\n</section>\nEnd`;
			const updated = editOrAddMetaInfo(original, { fileType: PAGE, index: 10, status: TextStatus.NotStarted });

			// Expect the meta block to be replaced (not duplicated) and updated
			expect(updated).toContain(
				`<section id={textfresser_meta_keep_me_invisible}>`
			);
			// JSON.stringify may order keys differently, so check parsed result instead
			const metaSectionMatch = updated.match(/<section id=\{textfresser_meta_keep_me_invisible\}>([\s\S]*?)<\/section>/);
			expect(metaSectionMatch).not.toBeNull();
			expect(metaSectionMatch?.[1]).toBeDefined();
			const metaJson = JSON.parse(metaSectionMatch![1]!.trim());
			expect(metaJson).toEqual({ fileType: "Page", index: 10, status: "NotStarted" });

			const afterExtract = extractMetaInfo(updated);
			expect(afterExtract).toEqual({ fileType: PAGE, index: 10, status: TextStatus.NotStarted });
		});

		it('appends a new meta section when none exists', () => {
			const original = 'Just some content';
			const updated = editOrAddMetaInfo(original, { fileType: PAGE, index: 0, status: TextStatus.NotStarted });

			// Should append a line break then the section
			expect(updated.startsWith(original)).toBe(true);
			expect(updated).toContain(
				`<section id={textfresser_meta_keep_me_invisible}>`
			);
			// JSON.stringify may order keys differently, so check parsed result instead
			const metaSectionMatch = updated.match(/<section id=\{textfresser_meta_keep_me_invisible\}>([\s\S]*?)<\/section>/);
			expect(metaSectionMatch).not.toBeNull();
			expect(metaSectionMatch?.[1]).toBeDefined();
			const metaJson = JSON.parse(metaSectionMatch![1]!.trim());
			expect(metaJson).toEqual({ fileType: "Page", index: 0, status: "NotStarted" });

			const afterExtract = extractMetaInfo(updated);
			expect(afterExtract).toEqual({ fileType: PAGE, index: 0, status: TextStatus.NotStarted });
		});

		it('handles missing index in existing meta section', () => {
			const original = `Start\n<section id={textfresser_meta_keep_me_invisible}>\n{"fileType":"Page", "status":"NotStarted"}\n</section>\nEnd`;
			
			// extractMetaInfo should return null when index is missing (validation fails)
			const extractedBefore = extractMetaInfo(original);
			expect(extractedBefore).toBeNull();

			// editOrAddMetaInfo should still work - it replaces the section with new meta
			const updated = editOrAddMetaInfo(original, { fileType: PAGE, index: 42, status: TextStatus.NotStarted });
			const afterExtract = extractMetaInfo(updated);
			expect(afterExtract).toEqual({ fileType: PAGE, index: 42, status: TextStatus.NotStarted });
		});

		it('handles index > 999 by failing validation', () => {
			const input = `Hello\n<section id={textfresser_meta_keep_me_invisible}>\n{"fileType":"Page", "index":1000, "status":"NotStarted"}\n</section>\nWorld`;
			
			// extractMetaInfo should return null when index > 999 (validation fails)
			const result = extractMetaInfo(input);
			expect(result).toBeNull();
		});

		it('handles index exactly at boundary (999)', () => {
			const input = `Hello\n<section id={textfresser_meta_keep_me_invisible}>\n{"fileType":"Page", "index":999, "status":"NotStarted"}\n</section>\nWorld`;
			const result = extractMetaInfo(input);
			
			expect(result).toEqual({ fileType: PAGE, index: 999, status: TextStatus.NotStarted });
		});

		it('handles index at minimum boundary (0)', () => {
			const input = `Hello\n<section id={textfresser_meta_keep_me_invisible}>\n{"fileType":"Page", "index":0, "status":"NotStarted"}\n</section>\nWorld`;
			const result = extractMetaInfo(input);
			
			expect(result).toEqual({ fileType: PAGE, index: 0, status: TextStatus.NotStarted });
		});

		it('handles negative index by failing validation', () => {
			const input = `Hello\n<section id={textfresser_meta_keep_me_invisible}>\n{"fileType":"Page", "index":-1, "status":"NotStarted"}\n</section>\nWorld`;
			
			// extractMetaInfo should return null when index < 0 (validation fails)
			const result = extractMetaInfo(input);
			expect(result).toBeNull();
		});
	});
});
