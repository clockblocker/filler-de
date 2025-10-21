import { describe, expect, it } from 'bun:test';

import {
	joinPosix,
	pathToFolderFromPathParts,
	safeFileName,
	systemPathFromPrettyPath,
	systemPathToFileFromPrettyPath,
	systemPathToFolderFromPrettyPath,
	systemPathToPrettyPath,
} from '../../../src/pure-formatters/paths/path-helpers';
import type { PrettyPath } from '../../../src/types/general';

describe('path-helpers', () => {
	describe('systemPathToPrettyPath', () => {
		it('returns empty pathParts and title for empty string', () => {
			const result = systemPathToPrettyPath('');
			expect(result).toEqual({ pathParts: [], title: '' });
		});

		it('returns empty pathParts and title for root path', () => {
			const result = systemPathToPrettyPath('/');
			expect(result).toEqual({ pathParts: [], title: '' });
		});

		it('converts simple file path correctly', () => {
			const result = systemPathToPrettyPath('/file.md');
			expect(result).toEqual({ pathParts: [], title: 'file.md' });
		});

		it('converts nested file path correctly', () => {
			const result = systemPathToPrettyPath('/folder/subfolder/file.md');
			expect(result).toEqual({
				pathParts: ['folder', 'subfolder'],
				title: 'file.md',
			});
		});

		it('converts folder path correctly', () => {
			const result = systemPathToPrettyPath('/folder/subfolder/');
			expect(result).toEqual({
				pathParts: ['folder'],
				title: 'subfolder',
			});
		});

		it('handles path without leading slash', () => {
			const result = systemPathToPrettyPath('folder/file.md');
			expect(result).toEqual({
				pathParts: ['folder'],
				title: 'file.md',
			});
		});

		it('handles multiple consecutive slashes', () => {
			const result = systemPathToPrettyPath('//folder///subfolder//file.md');
			expect(result).toEqual({
				pathParts: ['folder', 'subfolder'],
				title: 'file.md',
			});
		});

		it('handles path with only folder name', () => {
			const result = systemPathToPrettyPath('folder');
			expect(result).toEqual({
				pathParts: [],
				title: 'folder',
			});
		});
	});

	describe('systemPathFromPrettyPath', () => {
		it('converts file pretty path to system path', () => {
			const prettyPath: PrettyPath = {
				pathParts: ['folder', 'subfolder'],
				title: 'file',
			};
			const result = systemPathFromPrettyPath({ prettyPath, isFile: true });
			expect(result).toBe('folder/subfolder/file.md');
		});

		it('converts folder pretty path to system path', () => {
			const prettyPath: PrettyPath = {
				pathParts: ['folder', 'subfolder'],
				title: 'folder',
			};
			const result = systemPathFromPrettyPath({ prettyPath, isFile: false });
			expect(result).toBe('folder/subfolder/folder');
		});

		it('handles empty pathParts', () => {
			const prettyPath: PrettyPath = {
				pathParts: [],
				title: 'file',
			};
			const result = systemPathFromPrettyPath({ prettyPath, isFile: true });
			expect(result).toBe('file.md');
		});

		it('handles empty title', () => {
			const prettyPath: PrettyPath = {
				pathParts: ['folder'],
				title: '',
			};
			const result = systemPathFromPrettyPath({ prettyPath, isFile: true });
			expect(result).toBe('folder/.md');
		});
	});

	describe('systemPathToFileFromPrettyPath', () => {
		it('converts pretty path to file system path', () => {
			const prettyPath: PrettyPath = {
				pathParts: ['folder'],
				title: 'file',
			};
			const result = systemPathToFileFromPrettyPath(prettyPath);
			expect(result).toBe('folder/file.md');
		});
	});

	describe('systemPathToFolderFromPrettyPath', () => {
		it('converts pretty path to folder system path', () => {
			const prettyPath: PrettyPath = {
				pathParts: ['folder'],
				title: 'subfolder',
			};
			const result = systemPathToFolderFromPrettyPath(prettyPath);
			expect(result).toBe('folder/subfolder');
		});
	});

	describe('safeFileName', () => {
		it('replaces forward slashes with spaces', () => {
			const result = safeFileName('file/name');
			expect(result).toBe('file name');
		});

		it('replaces backslashes with spaces', () => {
			const result = safeFileName('file\\name');
			expect(result).toBe('file name');
		});

		it('replaces both forward and back slashes', () => {
			const result = safeFileName('file/name\\with\\slashes');
			expect(result).toBe('file name with slashes');
		});

		it('trims whitespace', () => {
			const result = safeFileName('  file name  ');
			expect(result).toBe('file name');
		});

		it('handles empty string', () => {
			const result = safeFileName('');
			expect(result).toBe('');
		});

		it('handles string with only slashes', () => {
			const result = safeFileName('///');
			expect(result).toBe('');
		});

		it('handles string with only whitespace', () => {
			const result = safeFileName('   ');
			expect(result).toBe('');
		});
	});

	describe('pathToFolderFromPathParts', () => {
		it('joins path parts with forward slashes', () => {
			const result = pathToFolderFromPathParts(['folder', 'subfolder']);
			expect(result).toBe('folder/subfolder');
		});

		it('handles empty array', () => {
			const result = pathToFolderFromPathParts([]);
			expect(result).toBe('');
		});

		it('handles single path part', () => {
			const result = pathToFolderFromPathParts(['folder']);
			expect(result).toBe('folder');
		});

		it('handles array with empty strings', () => {
			const result = pathToFolderFromPathParts(['folder', '', 'subfolder']);
			expect(result).toBe('folder/subfolder');
		});
	});

	describe('joinPosix', () => {
		it('joins multiple path parts with forward slashes', () => {
			const result = joinPosix('folder', 'subfolder', 'file');
			expect(result).toBe('folder/subfolder/file');
		});

		it('handles empty parts', () => {
			const result = joinPosix('folder', '', 'file');
			expect(result).toBe('folder/file');
		});

		it('handles parts with leading slashes', () => {
			const result = joinPosix('/folder', '/subfolder');
			expect(result).toBe('folder/subfolder');
		});

		it('handles parts with trailing slashes', () => {
			const result = joinPosix('folder/', 'subfolder/');
			expect(result).toBe('folder/subfolder');
		});

		it('handles parts with both leading and trailing slashes', () => {
			const result = joinPosix('/folder/', '/subfolder/');
			expect(result).toBe('folder/subfolder');
		});

		it('handles parts with backslashes', () => {
			const result = joinPosix('\\folder\\', '\\subfolder\\');
			expect(result).toBe('folder/subfolder');
		});

		it('handles mixed forward and back slashes', () => {
			const result = joinPosix('/folder\\', '\\subfolder/');
			expect(result).toBe('folder/subfolder');
		});

		it('handles multiple consecutive slashes', () => {
			const result = joinPosix('folder///', '///subfolder');
			expect(result).toBe('folder/subfolder');
		});

		it('handles empty string parts', () => {
			const result = joinPosix('folder', '', 'subfolder');
			expect(result).toBe('folder/subfolder');
		});

		it('handles all empty parts', () => {
			const result = joinPosix('', '', '');
			expect(result).toBe('');
		});

		it('handles no arguments', () => {
			const result = joinPosix();
			expect(result).toBe('');
		});

		it('handles single part', () => {
			const result = joinPosix('folder');
			expect(result).toBe('folder');
		});

		it('handles parts with only slashes', () => {
			const result = joinPosix('///', '///');
			expect(result).toBe('');
		});

		it('handles whitespace-only parts', () => {
			const result = joinPosix('   ', '   ');
			expect(result).toBe('   /   ');
		});

		it('handles mixed valid and invalid parts', () => {
			const result = joinPosix('folder', '///', 'subfolder', '');
			expect(result).toBe('folder/subfolder');
		});
	});
});
