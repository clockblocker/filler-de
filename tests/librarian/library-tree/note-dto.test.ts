import { describe, expect, it } from 'bun:test';
import type { NoteDto, TreePath } from '../../../src/commanders/librarian/types';
import { TextStatus } from '../../../src/types/common-interface/enums';
import { AVATAR_NOTES } from '../static/batteries/avatar';

/**
 * Tests for NoteDto format (V2)
 * 
 * NoteDto is a flat structure where each file = one DTO:
 * - Scroll: single NoteDto with path = [...sectionPath, scrollName]
 * - Book: multiple NoteDtos with path = [...sectionPath, bookName, pageIndex]
 * 
 * This replaces TextDto's pageStatuses: Record<name, status> pattern.
 */
describe('NoteDto format (V2)', () => {
	describe('Structure validation', () => {
		it('should have path and status fields', () => {
			const note: NoteDto = {
				path: ['Section', 'Note'] as TreePath,
				status: TextStatus.NotStarted,
			};

			expect(note.path).toEqual(['Section', 'Note']);
			expect(note.status).toBe(TextStatus.NotStarted);
		});

		it('should support all TextStatus values', () => {
			const notStarted: NoteDto = {
				path: ['A'] as TreePath,
				status: TextStatus.NotStarted,
			};
			const done: NoteDto = {
				path: ['B'] as TreePath,
				status: TextStatus.Done,
			};
			const inProgress: NoteDto = {
				path: ['C'] as TreePath,
				status: TextStatus.InProgress,
			};

			expect(notStarted.status).toBe('NotStarted');
			expect(done.status).toBe('Done');
			expect(inProgress.status).toBe('InProgress');
		});
	});

	describe('Scroll representation', () => {
		it('scroll = single NoteDto at section level', () => {
			// A scroll "Intro" at root = NoteDto with path ['Intro']
			const scroll: NoteDto = {
				path: ['Intro'] as TreePath,
				status: TextStatus.NotStarted,
			};

			expect(scroll.path.length).toBe(1);
			expect(scroll.path[0]).toBe('Intro');
		});

		it('scroll in section = NoteDto with section path', () => {
			// A scroll "Episode_1" in section ["Avatar", "Season_1"]
			const scroll: NoteDto = {
				path: ['Avatar', 'Season_1', 'Episode_1'] as TreePath,
				status: TextStatus.Done,
			};

			expect(scroll.path).toEqual(['Avatar', 'Season_1', 'Episode_1']);
		});
	});

	describe('Book representation', () => {
		it('book = multiple NoteDtos under section path', () => {
			// A book "Episode_2" with 2 pages in section ["Avatar", "Season_1"]
			// Book becomes a section containing notes
			const page0: NoteDto = {
				path: ['Avatar', 'Season_1', 'Episode_2', '000'] as TreePath,
				status: TextStatus.Done,
			};
			const page1: NoteDto = {
				path: ['Avatar', 'Season_1', 'Episode_2', '001'] as TreePath,
				status: TextStatus.NotStarted,
			};

			// Both pages share the same prefix (book path)
			const bookPath = page0.path.slice(0, -1);
			expect(bookPath).toEqual(['Avatar', 'Season_1', 'Episode_2']);
			expect(page1.path.slice(0, -1)).toEqual(bookPath);

			// Page indices are the last element
			expect(page0.path[page0.path.length - 1]).toBe('000');
			expect(page1.path[page1.path.length - 1]).toBe('001');
		});

		it('book pages have independent statuses', () => {
			const pages: NoteDto[] = [
				{ path: ['Book', '000'] as TreePath, status: TextStatus.Done },
				{ path: ['Book', '001'] as TreePath, status: TextStatus.NotStarted },
				{ path: ['Book', '002'] as TreePath, status: TextStatus.Done },
			];

			const doneCount = pages.filter(p => p.status === TextStatus.Done).length;
			const notStartedCount = pages.filter(p => p.status === TextStatus.NotStarted).length;

			expect(doneCount).toBe(2);
			expect(notStartedCount).toBe(1);
		});
	});

	describe('AVATAR_NOTES fixture', () => {
		it('should have correct number of notes', () => {
			// Avatar has:
			// - Episode_1 (scroll) in Season_1
			// - Episode_2 (book with 2 pages) in Season_1
			// - Episode_1 (scroll) in Season_2
			// - Episode_2 (scroll) in Season_2
			// - Intro (scroll) at root
			// Total: 6 NoteDtos
			expect(AVATAR_NOTES.length).toBe(6);
		});

		it('scrolls have 3-part paths (section/subsection/name)', () => {
			const scrolls = AVATAR_NOTES.filter(n => 
				n.path.length === 3 && !n.path[n.path.length - 1]?.match(/^\d{3}$/)
			);
			
			expect(scrolls.length).toBeGreaterThan(0);
			for (const scroll of scrolls) {
				expect(scroll.path.length).toBe(3);
			}
		});

		it('book pages have 4-part paths with numeric suffix', () => {
			const bookPages = AVATAR_NOTES.filter(n => 
				n.path[n.path.length - 1]?.match(/^\d{3}$/)
			);

			expect(bookPages.length).toBe(2); // Episode_2 has 2 pages
			for (const page of bookPages) {
				expect(page.path.length).toBe(4);
				expect(page.path[page.path.length - 1]).toMatch(/^\d{3}$/);
			}
		});

		it('all notes have NotStarted status initially', () => {
			for (const note of AVATAR_NOTES) {
				expect(note.status).toBe('NotStarted');
			}
		});
	});

	describe('Conversion helpers (future)', () => {
		it('can group NoteDtos by parent path (book detection)', () => {
			const notes: NoteDto[] = [
				{ path: ['Section', 'Scroll'] as TreePath, status: TextStatus.Done },
				{ path: ['Section', 'Book', '000'] as TreePath, status: TextStatus.Done },
				{ path: ['Section', 'Book', '001'] as TreePath, status: TextStatus.NotStarted },
			];

			// Group by parent path
			const groups = new Map<string, NoteDto[]>();
			for (const note of notes) {
				const parentKey = note.path.slice(0, -1).join('/');
				const existing = groups.get(parentKey) ?? [];
				groups.set(parentKey, [...existing, note]);
			}

			// 'Section' contains 1 scroll
			expect(groups.get('Section')?.length).toBe(1);
			// 'Section/Book' contains 2 pages
			expect(groups.get('Section/Book')?.length).toBe(2);
		});

		it('can detect scroll vs book by sibling count', () => {
			const notes: NoteDto[] = [
				{ path: ['Scroll'] as TreePath, status: TextStatus.Done },
				{ path: ['Book', '000'] as TreePath, status: TextStatus.Done },
				{ path: ['Book', '001'] as TreePath, status: TextStatus.Done },
			];

			// Group by parent
			const groups = new Map<string, NoteDto[]>();
			for (const note of notes) {
				const parentKey = note.path.slice(0, -1).join('/') || '__root__';
				const existing = groups.get(parentKey) ?? [];
				groups.set(parentKey, [...existing, note]);
			}

			// Root has 1 scroll (no siblings with same parent)
			const rootNotes = groups.get('__root__') ?? [];
			const isScroll = rootNotes.length === 1;
			expect(isScroll).toBe(true);

			// Book has multiple pages (siblings with same parent)
			const bookNotes = groups.get('Book') ?? [];
			const isBook = bookNotes.length > 1;
			expect(isBook).toBe(true);
		});
	});
});
