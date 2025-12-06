import { TextStatus } from "../../../types/common-interface/enums";
import {
	BACK_ARROW,
	DONE_CHECKBOX,
	LINE_BREAK,
	NOT_STARTED_CHECKBOX,
	SPACE_F,
	TAB,
} from "../../../types/literals";
import { PageBasenameSchema } from "../indexing/codecs";
import type { BackLink, CodexContent, CodexItem } from "./types";

export class CodexFormatter {
	format(content: CodexContent): string {
		const lines: string[] = [];

		if (content.backLink) {
			lines.push(this.formatBackLink(content.backLink));
		}

		lines.push(...this.formatItems(content.items, 0));

		return (
			LINE_BREAK +
			lines.map((l) => `${l}${SPACE_F}${LINE_BREAK}`).join("")
		);
	}

	// ─── Private Helpers ─────────────────────────────────────────────

	private formatBackLink(backLink: BackLink): string {
		if (!backLink) return "";
		return `[[${backLink.target}|${BACK_ARROW} ${backLink.displayName}]]`;
	}

	private formatItems(items: CodexItem[], depth: number): string[] {
		const lines: string[] = [];
		const indent = TAB.repeat(depth);

		for (const item of items) {
			const checkbox = this.statusToCheckbox(item.status);
			const link = `[[${item.target}|${item.displayName}]]`;
			if (PageBasenameSchema.safeParse(item.target).success) {
				if (depth > 1) {
					continue;
				}
			}
			lines.push(`${indent}${checkbox} ${link}`);

			// Recurse into children
			if (item.children.length > 0) {
				lines.push(...this.formatItems(item.children, depth + 1));
			}
		}

		return lines;
	}

	private statusToCheckbox(status: TextStatus): string {
		return status === TextStatus.Done
			? DONE_CHECKBOX
			: NOT_STARTED_CHECKBOX;
	}
}

/** Singleton instance */
export const codexFormatter = new CodexFormatter();
