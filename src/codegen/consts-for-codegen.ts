// blocknames.ts
export const BLOCK_NAMES = ['actions', 'morphems'] as const;

export type BlockName = (typeof BLOCK_NAMES)[number];
