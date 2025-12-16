// For a given path: "Library/parent/child/NoteName-child-parent.md"
export type CoreName = string; // NoteName
export type SplitSuffix = CoreName[]; // ["child", "parent"]
export type CoreNameChainFromRoot = CoreName[]; // ["parent", "child"]

export type SplitBasename = { coreName: CoreName; splitSuffix: SplitSuffix };
