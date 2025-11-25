import { TextStatus } from "../../../types/common-interface/enums";
import type { BackLink, CodexContent, CodexItem, CodexType } from "./types";

/**
 * Formats CodexContent to Obsidian markdown.
 */
export class CodexFormatter {
	/**
	 * Format full Codex content to markdown.
	 */
	format(content: CodexContent, type: CodexType): string {
		const lines: string[] = [];

		// Back link
		if (content.backLink) {
			lines.push(this.formatBackLink(content.backLink));
			lines.push(""); // Empty line after back link
		}

		// Items
		if (type === "section") {
			lines.push(...this.formatNestedItems(content.items, 0));
		} else {
			lines.push(...this.formatFlatItems(content.items));
		}

		return lines.join("\n");
	}

	// ─── Private Helpers ─────────────────────────────────────────────

	private formatBackLink(backLink: BackLink): string {
		if (!backLink) return "";
		return `[[${backLink.target}|← ${backLink.displayName}]]`;
	}

	private formatNestedItems(items: CodexItem[], depth: number): string[] {
		const lines: string[] = [];
		const indent = "\t".repeat(depth);

		for (const item of items) {
			const checkbox = this.statusToCheckbox(item.status);
			const link = `[[${item.target}|${item.displayName}]]`;
			lines.push(`${indent}- ${checkbox} ${link}`);

			// Recurse into children
			if (item.children.length > 0) {
				lines.push(...this.formatNestedItems(item.children, depth + 1));
			}
		}

		return lines;
	}

	private formatFlatItems(items: CodexItem[]): string[] {
		return items.map((item) => {
			const checkbox = this.statusToCheckbox(item.status);
			const link = `[[${item.target}|${item.displayName}]]`;
			return `- ${checkbox} ${link}`;
		});
	}

	private statusToCheckbox(status: TextStatus): string {
		return status === TextStatus.Done ? "[x]" : "[ ]";
	}
}

/** Singleton instance */
export const codexFormatter = new CodexFormatter();
