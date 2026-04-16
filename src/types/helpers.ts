export type Prettify<T> = {
	[K in keyof T]: T[K];
} & {};

export type PrettifyDeep<T> = T extends
	| string
	| number
	| boolean
	| bigint
	| symbol
	| null
	| undefined
	| Function
	? T
	: T extends readonly unknown[]
		? {
				[K in keyof T]: PrettifyDeep<T[K]>;
			}
		: T extends object
			? {
					[K in keyof T]: PrettifyDeep<T[K]>;
				} & {}
			: T;

export type Merge<A, B> = Prettify<Omit<A, keyof B> & B>;

export type MergeByKey<A, B> = Prettify<{
	[K in keyof A | keyof B]: K extends keyof A
		? K extends keyof B
			? Prettify<A[K] & B[K]>
			: A[K]
		: K extends keyof B
			? B[K]
			: never;
}>;

export type ReplaceProp<T, K extends PropertyKey, V> = Prettify<
	Omit<T, K> & Record<K, V>
>;

export type Optional<T, K extends keyof T> = Prettify<
	Omit<T, K> & Partial<Pick<T, K>>
>;

export type SubsetOf<T extends PropertyKey> = Prettify<
	Partial<Record<T, true>>
>;

export type EmptyShape = Record<never, never>;

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
