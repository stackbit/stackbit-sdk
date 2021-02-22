
interface PromiseAccumulator<T, U> {
    (accumulator: U, currentValue: T, index: number, array: T[]): Promise<U>
}

export function reducePromise<T, U>(array: T[], callback: PromiseAccumulator<T, U>, initValue: U, thisArg?: any): Promise<U> {
    return new Promise((resolve, reject) => {
        function next(index: number, accumulator: U) {
            if (index < array.length) {
                callback.call(thisArg, accumulator, <T>array[index], index, array).then(accumulator => {
                    next(index + 1, accumulator);
                }).catch(error => {
                    reject(error);
                });
            } else {
                resolve(accumulator);
            }
        }

        next(0, initValue);
    });
}
