import { describe, it, expect } from 'bun:test';
import {
	NodeStatus,
	NodeType,
	type TextNode,
	type TreeNode,
} from '../../src/currator/types';
import { CurratedTree } from '../../src/currator/currated-tree';

const nodes = [
	{
		name: 'Avatar',
		status: NodeStatus.NotStarted,
		type: NodeType.Section,
		children: [
			{
				name: 'Season_1',
				status: NodeStatus.NotStarted,
				type: NodeType.Section,
				children: [
					{
						name: 'Episode_1',
						status: NodeStatus.NotStarted,
						type: NodeType.Text,
						children: [
							{
								type: NodeType.Page,
								status: NodeStatus.NotStarted,
								index: 0,
							},
						],
					},
					{
						name: 'Episode_2',
						status: NodeStatus.NotStarted,
						type: NodeType.Text,
						children: [
							{
								status: NodeStatus.NotStarted,
								type: NodeType.Page,
								index: 0,
							},
							{
								type: NodeType.Page,
								status: NodeStatus.NotStarted,
								index: 1,
							},
						],
					},
				],
			},
			{
				name: 'Season_2',
				status: NodeStatus.NotStarted,
				type: NodeType.Section,
				children: [
					{
						name: 'Episode_2',
						status: NodeStatus.NotStarted,
						children: [
							{
								type: NodeType.Page,
								status: NodeStatus.NotStarted,
								index: 0,
							},
						],
						type: NodeType.Text,
					},
					{
						name: 'Episode_2',
						status: NodeStatus.NotStarted,
						children: [
							{
								type: NodeType.Page,
								status: NodeStatus.NotStarted,
								index: 0,
							},
						],
						type: NodeType.Text,
					},
				],
			},
		],
	},
	{
		name: 'Intro',
		status: NodeStatus.NotStarted,
		type: NodeType.Text,
		children: [
			{
				type: NodeType.Page,
				status: NodeStatus.NotStarted,
				index: 0,
			},
		],
	},
] as const satisfies TreeNode[];

describe('CurratedTree', () => {
	it('should get Intro by path', () => {
		const tree = new CurratedTree(nodes);
		const node = tree.getMaybeNode(['Intro']);
		expect(node).toEqual({ error: false, data: nodes[1] as TextNode });
	});

	it('should get Avatar-Season_1-Episode_1 by path', () => {
		const tree = new CurratedTree(nodes);
		const node = tree.getMaybeNode(['Avatar', 'Season_1', 'Episode_1']);
		expect(node).toEqual({
			error: false,
			data: nodes[0]?.children[0]?.children[0] as TextNode,
		});
	});

	it('should get Avatar-Season_2-Episode_2 by path', () => {
		const tree = new CurratedTree(nodes);
		const node = tree.getMaybeNode(['Avatar', 'Season_2', 'Episode_2']);
		expect(node).toEqual({
			error: false,
			data: nodes[0]?.children[1]?.children[0] as TextNode,
		});
	});

	it('should not get Avatar-Season_2-Episode_3 by path', () => {
		const tree = new CurratedTree(nodes);
		const node = tree.getMaybeNode(['Avatar', 'Season_2', 'Episode_3']);
		expect(node).toEqual({
			error: true,
			description: 'Node "Episode_3" not found',
		});
	});
});
