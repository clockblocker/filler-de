import { Notice } from 'obsidian';
import { z } from 'zod';
import type { TexfresserObsidianServices } from '../../services/obsidian-services/interface';

export class Currator {
	private backgroundFileService: TexfresserObsidianServices['backgroundFileService'];
	private openedFileService: TexfresserObsidianServices['openedFileService'];

	constructor({
		backgroundFileService,
		openedFileService,
	}: TexfresserObsidianServices) {
		this.backgroundFileService = backgroundFileService;
		this.openedFileService = openedFileService;
	}
}
