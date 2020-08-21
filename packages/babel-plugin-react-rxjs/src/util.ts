export function assertType<TValue, TType extends TValue>(
  checkFn: (node: TValue) => node is TType,
  value: TValue | null | undefined,
): TType | null {
  if (value && checkFn(value)) {
    return value
  }
  return null
}
