interface PromiseAccumulator<T, U> {
    (accumulator: U, currentValue: T, index: number, array: T[]): Promise<U>;
}

export function reducePromise<T, U>(array: T[], callback: PromiseAccumulator<T, U>, initValue: U, thisArg?: any): Promise<U> {
    return new Promise((resolve, reject) => {
        function next(index: number, accumulator: U) {
            if (index < array.length) {
                callback
                    .call(thisArg, accumulator, <T>array[index], index, array)
                    .then((accumulator) => {
                        next(index + 1, accumulator);
                    })
                    .catch((error) => {
                        reject(error);
                    });
            } else {
                resolve(accumulator);
            }
        }

        next(0, initValue);
    });
}

type UnionKeys<U> = U extends any ? keyof U : never;

type ForbiddenPropertiesOfUnionMember<T, Union, Keys extends string = UnionKeys<Union> extends string ? UnionKeys<Union> : never> = {
    [k in Exclude<Keys, keyof T>]?: undefined;
};

type StricterUnionMember<T, Union, Keys extends string = UnionKeys<Union> extends string ? UnionKeys<Union> : never> = T &
    ForbiddenPropertiesOfUnionMember<T, Union, Keys>;

export type StricterUnion<Union, Union2 = Union> = Union2 extends any ? StricterUnionMember<Union2, Union> : never;
