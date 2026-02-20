/**
 * YAML frontmatter format for metadata.
 * Not exported from the module - use public API instead.
 */

import {
	TreeNodeStatus,
	type TreeNodeStatus as TreeNodeStatusType,
} from "../../../commanders/librarian/healer/library-tree/tree-node/types/atoms";
import type { Transform } from "../../../managers/obsidian/vault-action-manager/types/vault-action";

// ─── Constants ───

/** Pattern to match YAML frontmatter at start of file */
const FRONTMATTER_PATTERN = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

// ─── Types ───

export type ScrollMetadataWithImport = {
	status: TreeNodeStatusType;
} & Record<string, unknown>;

// ─── Helpers ───

/**
 * Parse simple YAML key-value pairs.
 * Handles: strings, numbers, booleans, dates, arrays (inline and multiline).
 */
function parseSimpleYaml(yamlContent: string): Record<string, unknown> {
	const result: Record<string, unknown> = {};
	const lines = yamlContent.split(/\r?\n/);

	let currentKey: string | null = null;
	let currentArray: unknown[] | null = null;

	for (const line of lines) {
		// Skip empty lines and comments
		if (line.trim() === "" || line.trim().startsWith("#")) continue;

		// Array item (indented with -)
		const arrayItemMatch = line.match(/^\s+-\s+(.*)$/);
		const arrayItemValue = arrayItemMatch?.[1];
		if (arrayItemValue !== undefined && currentKey && currentArray) {
			currentArray.push(parseValue(arrayItemValue.trim()));
			continue;
		}

		// Key-value pair
		const kvMatch = line.match(/^([a-zA-Z_][a-zA-Z0-9_-]*):\s*(.*)$/);
		const key = kvMatch?.[1];
		const rawValue = kvMatch?.[2]?.trim();
		if (key !== undefined && rawValue !== undefined) {
			// Save previous array if any
			if (currentKey && currentArray) {
				result[currentKey] = currentArray;
			}

			// Check for inline array [a, b, c]
			if (rawValue.startsWith("[") && rawValue.endsWith("]")) {
				const inner = rawValue.slice(1, -1);
				result[key] = inner
					.split(",")
					.map((s) => parseValue(s.trim()))
					.filter((v) => v !== "");
				currentKey = null;
				currentArray = null;
			} else if (rawValue === "") {
				// Multiline array starts
				currentKey = key;
				currentArray = [];
			} else {
				result[key] = parseValue(rawValue);
				currentKey = null;
				currentArray = null;
			}
		}
	}

	// Save final array if any
	if (currentKey && currentArray) {
		result[currentKey] = currentArray;
	}

	return result;
}

/**
 * Parse a single YAML value (string, number, boolean, null, date).
 */
function parseValue(raw: string): unknown {
	// Remove quotes
	if (
		(raw.startsWith('"') && raw.endsWith('"')) ||
		(raw.startsWith("'") && raw.endsWith("'"))
	) {
		return raw.slice(1, -1);
	}

	// Booleans
	if (raw === "true" || raw === "True" || raw === "TRUE") return true;
	if (raw === "false" || raw === "False" || raw === "FALSE") return false;

	// Null
	if (raw === "null" || raw === "~") return null;

	// Numbers
	if (/^-?\d+$/.test(raw)) return Number.parseInt(raw, 10);
	if (/^-?\d+\.\d+$/.test(raw)) return Number.parseFloat(raw);

	// Date-like (YYYY-MM-DD or YYYY-MM-DD HH:MM)
	if (/^\d{4}-\d{2}-\d{2}(\s+\d{2}:\d{2})?$/.test(raw)) {
		return raw; // Keep as string for simplicity
	}

	return raw;
}

// ─── Extract ───

/**
 * Extract frontmatter as raw string (not parsed).
 * Returns the frontmatter block including delimiters and the remaining body.
 */
export function extractFrontmatter(content: string): {
	frontmatter: string;
	body: string;
} {
	const match = content.match(FRONTMATTER_PATTERN);
	if (!match) return { body: content, frontmatter: "" };
	return { body: content.slice(match[0].length), frontmatter: match[0] };
}

// ─── Read ───

/**
 * Parse YAML frontmatter from note content.
 * Returns null if no frontmatter present.
 */
export function parseFrontmatter(
	content: string,
): Record<string, unknown> | null {
	const match = content.match(FRONTMATTER_PATTERN);
	if (!match?.[1]) return null;

	const parsed = parseSimpleYaml(match[1]);
	return Object.keys(parsed).length > 0 ? parsed : null;
}

/**
 * Strip YAML frontmatter from content.
 * Returns original content if no frontmatter present.
 */
export function stripOnlyFrontmatter(content: string): string {
	return content.replace(FRONTMATTER_PATTERN, "");
}

/**
 * Convert frontmatter object to internal metadata format.
 * Maps common status field values to internal status.
 * Spreads all other fields directly into metadata.
 */
export function frontmatterToInternal(
	fm: Record<string, unknown>,
): ScrollMetadataWithImport {
	// Status is derived only from canonical `status` key.
	const statusField = fm.status;
	const isDone =
		statusField === "done" ||
		statusField === TreeNodeStatus.Done ||
		statusField === "completed" ||
		statusField === "Completed" ||
		statusField === "true" ||
		statusField === true;

	return {
		...fm,
		status: isDone ? TreeNodeStatus.Done : TreeNodeStatus.NotStarted,
	};
}

// ─── Write ───

/**
 * Convert metadata object to YAML frontmatter string.
 * Preserves all fields. Status is output as boolean checkbox.
 */
export function internalToFrontmatter(meta: ScrollMetadataWithImport): string {
	const lines: string[] = ["---"];
	for (const [key, value] of Object.entries(meta)) {
		if (value === null || value === undefined) continue;
		// Convert status to boolean checkbox format
		if (key === "status") {
			lines.push(
				`status: ${value === TreeNodeStatus.Done ? "true" : "false"}`,
			);
		} else if (Array.isArray(value)) {
			lines.push(
				`${key}: [${value.map((v) => formatYamlValue(v)).join(", ")}]`,
			);
		} else {
			lines.push(`${key}: ${formatYamlValue(value)}`);
		}
	}
	lines.push("---");
	return lines.join("\n");
}

/**
 * Format a value for YAML output.
 */
function formatYamlValue(value: unknown): string {
	if (typeof value === "string") {
		// Quote strings that need escaping
		if (/[:#[\]{}'",\n]/.test(value) || value === "") {
			return `"${value.replace(/"/g, '\\"')}"`;
		}
		return value;
	}
	if (typeof value === "boolean") return value ? "true" : "false";
	if (typeof value === "number") return String(value);
	return String(value);
}

/**
 * Create transform that writes YAML frontmatter.
 * Replaces existing frontmatter or prepends new one.
 */
export function writeFrontmatter(meta: Record<string, unknown>): Transform {
	// Cast to ScrollMetadataWithImport for internalToFrontmatter
	// Status defaults to NotStarted if not provided
	const normalized: ScrollMetadataWithImport = {
		...meta,
		status:
			(meta.status as ScrollMetadataWithImport["status"]) ??
			TreeNodeStatus.NotStarted,
	};
	return (content: string) => {
		const withoutFm = stripOnlyFrontmatter(content);
		const yaml = internalToFrontmatter(normalized);
		return `${yaml}\n${withoutFm}`;
	};
}

/**
 * Create transform that updates status in YAML frontmatter.
 * If no frontmatter exists, creates one with just the status.
 * Status is stored as boolean checkbox (true/false).
 */
export function upsertFrontmatterStatus(status: TreeNodeStatusType): Transform {
	const statusValue = status === TreeNodeStatus.Done;

	return (content: string) => {
		const fm = parseFrontmatter(content);

		if (fm) {
			// Update existing frontmatter
			const updated: ScrollMetadataWithImport = { ...fm, status };
			const newYaml = internalToFrontmatter(updated);
			const withoutFm = stripOnlyFrontmatter(content);
			return `${newYaml}\n${withoutFm}`;
		}
		// No frontmatter - create one with just status
		return `---\nstatus: ${statusValue}\n---\n${content}`;
	};
}
