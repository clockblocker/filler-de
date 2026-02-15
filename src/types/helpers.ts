export type Prettify<T> = {
	[K in keyof T]: T[K];
} & {};

export type Optional<T, K extends keyof T> = Prettify<
	Omit<T, K> & Partial<Pick<T, K>>
>;

export const isReadonlyArray = <T>(x: T | readonly T[]): x is readonly T[] =>
	Array.isArray(x);

export type NonEmptyArray<T> = [T, ...T[]];

/**
 * Inverts a record type, swapping keys and values.
 * Used to derive reverse mapping from TreeNodeKind → SplitPathKind.
 */
export type InvertRecord<R extends Record<PropertyKey, PropertyKey>> = {
	[K in keyof R as R[K]]: K;
};
