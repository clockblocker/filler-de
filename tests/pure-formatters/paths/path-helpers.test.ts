import { describe, expect, it } from 'bun:test';

import {
	joinPosix,
	pathToFolderFromPathParts,
	safeFileName,
	systemPathFromPrettyPath,
	systemPathToFileFromPrettyPath,
	systemPathToFolderFromPrettyPath,
	systemPathToPrettyPath,
} from '../../../src/services/dto-services/pathfinder/path-helpers';
import type { PrettyPath } from '../../../src/types/common-interface/dtos';

describe('path-helpers', () => {
	describe('systemPathToPrettyPath', () => {
		it('returns empty pathParts and title for empty string', () => {
			const result = systemPathToPrettyPath('');
			expect(result).toEqual({ basename: '', pathParts: [], type: 'folder' });
		});

		it('returns empty pathParts and title for root path', () => {
			const result = systemPathToPrettyPath('/');
			expect(result).toEqual({ basename: '', pathParts: [], type: 'folder' });
		});

		it('converts simple file path correctly', () => {
			const result = systemPathToPrettyPath('/file.md');
			expect(result).toEqual({ basename: 'file.md', pathParts: [], type: 'folder' });
		});

		it('converts nested file path correctly', () => {
			const result = systemPathToPrettyPath('/folder/subfolder/file.md');
			expect(result).toEqual({
				basename: 'file.md',
				pathParts: ['folder', 'subfolder'],
				type: 'folder',
			});
		});

		it('converts folder path correctly', () => {
			const result = systemPathToPrettyPath('/folder/subfolder/');
			expect(result).toEqual({
				basename: 'subfolder',
				pathParts: ['folder'],
				type: 'folder',
			});
		});

		it('handles path without leading slash', () => {
			const result = systemPathToPrettyPath('folder/file.md');
			expect(result).toEqual({
				basename: 'file.md',
				pathParts: ['folder'],
				type: 'folder',
			});
		});

		it('handles multiple consecutive slashes', () => {
			const result = systemPathToPrettyPath('//folder///subfolder//file.md');
			expect(result).toEqual({
				basename: 'file.md',
				pathParts: ['folder', 'subfolder'],
				type: 'folder',
			});
		});

		it('handles path with only folder name', () => {
			const result = systemPathToPrettyPath('folder');
			expect(result).toEqual({
				basename: 'folder',
				pathParts: [],
				type: 'folder',
			});
		});
	});

	describe('systemPathFromPrettyPath', () => {
		it('converts file pretty path to system path', () => {
			const prettyPath: PrettyPath = {
				basename: 'file',
				extension: 'md',
				pathParts: ['folder', 'subfolder'],
				type: 'file',
			};
			const result = systemPathFromPrettyPath(prettyPath);
			expect(result).toBe('folder/subfolder/file.md');
		});

		it('converts folder pretty path to system path', () => {
			const prettyPath: PrettyPath = {
				basename: 'folder',
				pathParts: ['folder', 'subfolder'],
				type: 'folder',
			};
			const result = systemPathFromPrettyPath(prettyPath);
			expect(result).toBe('folder/subfolder/folder');
		});

		it('handles empty pathParts', () => {
			const prettyPath: PrettyPath = {
				basename: 'file',
				extension: 'md',
				pathParts: [],
				type: 'file',
			};
			const result = systemPathFromPrettyPath(prettyPath);
			expect(result).toBe('file.md');
		});

		it('handles empty title', () => {
			const prettyPath: PrettyPath = {
				basename: '',
				extension: 'md',
				pathParts: ['folder'],
				type: 'file',
			};
			const result = systemPathFromPrettyPath(prettyPath);
			expect(result).toBe('folder/.md');
		});
	});

	describe('systemPathToFileFromPrettyPath', () => {
		it('converts pretty path to file system path', () => {
			const prettyPath: Extract<PrettyPath, { type: 'file' }> = {
				basename: 'file',
				extension: 'md',
				pathParts: ['folder'],
				type: 'file',
			};
			const result = systemPathToFileFromPrettyPath(prettyPath);
			expect(result).toBe('folder/file.md');
		});
	});

	describe('systemPathToFolderFromPrettyPath', () => {
		it('converts pretty path to folder system path', () => {
			const prettyPath: Extract<PrettyPath, { type: 'folder' }> = {
				basename: 'subfolder',
				pathParts: ['folder'],
				type: 'folder',
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
