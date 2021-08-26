type UnionKeys<U> = U extends any ? keyof U : never;

type ForbiddenPropertiesOfUnionMember<T, Union, Keys extends string = UnionKeys<Union> extends string ? UnionKeys<Union> : never> = {
    [k in Exclude<Keys, keyof T>]?: undefined;
};

type StricterUnionMember<T, Union, Keys extends string = UnionKeys<Union> extends string ? UnionKeys<Union> : never> = T &
    ForbiddenPropertiesOfUnionMember<T, Union, Keys>;

export type StricterUnion<Union, Union2 = Union> = Union2 extends any ? StricterUnionMember<Union2, Union> : never;

export type Logger = Pick<Console, 'log' | 'info' | 'warn' | 'error' | 'group' | 'groupEnd'>;

export * from './model-utils';
export * from './model-matcher';
export * from './model-extender';
export * from './model-iterators';
