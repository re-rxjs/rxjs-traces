export const Refs = Symbol("rxjs-debug-refs");

export interface WrappedNext<T = unknown> {
  value: T;
  [Refs]: Set<string>;
}

export const valueIsWrapped = <T>(value: any): value is WrappedNext<T> =>
  Boolean(value[Refs]);

export const unwrapValue = <T>(value: T | WrappedNext<T>) => {
  if(valueIsWrapped(value)) {
    return value.value;
  }
  return value;
}