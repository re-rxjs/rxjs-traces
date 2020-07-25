/**
 * Clones the object changing the values that can't be transmitted:
 *  - Symbols
 *  - undefined
 */
export function prepareForTransmit<T>(
  value: T,
  visitedValues = new WeakMap<any, any>()
) {
  switch (typeof value) {
    case 'symbol':
      return String(value);
    case 'undefined':
      return 'Symbol(undefined)';
    case 'object':
      if (value === null) {
        return value;
      }

      if (visitedValues.has(value)) {
        return visitedValues.get(value);
      }

      if (Array.isArray(value)) {
        const result: any[] = [];
        visitedValues.set(value, result);
        value.forEach(v => result.push(prepareForTransmit(v, visitedValues)));
        return result;
      }

      const result: any = {};
      visitedValues.set(value, result);
      Object.keys(value).forEach(
        key =>
          (result[key] = prepareForTransmit((value as any)[key], visitedValues))
      );
      return result;
    default:
      return value;
  }
}
