export const Refs = Symbol('rxjs-debug-refs');

export interface WrappedValue<T = unknown> {
  value: T;
  [Refs]: Set<string>;
}

export const valueIsWrapped = <T>(value: any): value is WrappedValue<T> =>
  Boolean(value && value[Refs]);

export const unwrapValue = <T>(value: T | WrappedValue<T>) => {
  if (valueIsWrapped(value)) {
    return value.value;
  }
  return value;
};
