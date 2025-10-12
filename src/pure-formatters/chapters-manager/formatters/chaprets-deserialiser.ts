import type { ChapterItem, ChapterSerializeOptions } from '../types';

export function chapterItemsToMarkdown(
	items: ChapterItem[],
	opts: ChapterSerializeOptions = {}
): string {
	const {
		indent = '\t',
		bullets = ['-', '*'],
		boldGroups = true,
		displayText = (title) => title,
		linkTarget = (title) => `${title}-index`,
		groupSort = (a, b) =>
			a.localeCompare(b, undefined, { sensitivity: 'base' }),
		leafSort = (a, b) =>
			a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }),
	} = opts;

	type Node = {
		name: string;
		children: Map<string, Node>;
		leaves: ChapterItem[];
	};

	const root: Node = { name: '__ROOT__', children: new Map(), leaves: [] };

	// Build tree
	for (const it of items) {
		let cur = root;
		for (const part of it.pathParts) {
			if (!cur.children.has(part)) {
				cur.children.set(part, { name: part, children: new Map(), leaves: [] });
			}
			cur = cur.children.get(part)!;
		}
		cur.leaves.push(it);
	}

	const bulletFor = (depth: number) =>
		bullets[Math.min(depth, bullets.length - 1)] ?? '-';

	const lines: string[] = [];

	function emitNode(node: Node, depth: number, path: string[]) {
		const childNames = Array.from(node.children.keys()).sort(groupSort);
		const sortedLeaves = [...node.leaves].sort(leafSort);

		const emitLeaves = () => {
			for (const it of sortedLeaves) {
				const bullet = bulletFor(depth);
				const display = displayText(it.title, path);
				const target = linkTarget(it.title, path);
				const check = it.done ? 'x' : ' ';
				lines.push(
					`${indent.repeat(depth)}${bullet} [${check}] [[${target}|${display}]]`
				);
			}
		};

		const emitGroups = () => {
			for (const name of childNames) {
				const child = node.children.get(name)!;
				const bullet = bulletFor(depth);
				const label = boldGroups ? `**${name}**` : name;
				lines.push(`${indent.repeat(depth)}${bullet} ${label}`);
				emitNode(child, depth + 1, [...path, name]);
			}
		};

		emitLeaves();
		emitGroups();
	}

	emitNode(root, 0, []);
	return lines.join('\n');
}
