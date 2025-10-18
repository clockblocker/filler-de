import {
	NodeStatus,
	NodeType,
	type TreeNode,
	type TreePath,
	type SerializedText,
} from '../../../../src/currator/tree-types';

export const AVATAR_NODES = [
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
						name: 'Episode_1',
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

export const AVATAR_TEXTS = [
	{ path: ['Intro'], pageStatuses: [NodeStatus.NotStarted] },
	{
		path: ['Avatar', 'Season_1', 'Episode_1'],
		pageStatuses: [NodeStatus.NotStarted],
	},
	{
		path: ['Avatar', 'Season_1', 'Episode_2'],
		pageStatuses: [NodeStatus.NotStarted],
	},
	{
		path: ['Avatar', 'Season_2', 'Episode_1'],
		pageStatuses: [NodeStatus.NotStarted],
	},
	{
		path: ['Avatar', 'Season_2', 'Episode_2'],
		pageStatuses: [NodeStatus.NotStarted],
	},
] as const satisfies SerializedText[];
