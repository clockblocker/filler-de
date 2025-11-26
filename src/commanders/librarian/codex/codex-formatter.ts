import { TextStatus } from "../../../types/common-interface/enums";
import type { BackLink, CodexContent, CodexItem } from "./types";

/**
 * Formats CodexContent to Obsidian markdown.
 * All codexes use the same nested format - indentation is determined by children.
 */
export class CodexFormatter {
	/**
	 * Format full Codex content to markdown.
	 */
	format(content: CodexContent): string {
		const lines: string[] = [];

		// Back link
		if (content.backLink) {
			lines.push(this.formatBackLink(content.backLink));
			lines.push(""); // Empty line after back link
		}

		// Items - always nested, depth determined by children
		lines.push(...this.formatItems(content.items, 0));

		return lines.join("\n");
	}

	// ─── Private Helpers ─────────────────────────────────────────────

	private formatBackLink(backLink: BackLink): string {
		if (!backLink) return "";
		return `[[${backLink.target}|← ${backLink.displayName}]]`;
	}

	private formatItems(items: CodexItem[], depth: number): string[] {
		const lines: string[] = [];
		const indent = "\t".repeat(depth);

		for (const item of items) {
			const checkbox = this.statusToCheckbox(item.status);
			const link = `[[${item.target}|${item.displayName}]]`;
			lines.push(`${indent}- ${checkbox} ${link}`);

			// Recurse into children
			if (item.children.length > 0) {
				lines.push(...this.formatItems(item.children, depth + 1));
			}
		}

		return lines;
	}

	private statusToCheckbox(status: TextStatus): string {
		return status === TextStatus.Done ? "[x]" : "[ ]";
	}
}

/** Singleton instance */
export const codexFormatter = new CodexFormatter();
