export const serializeJSON = (value: unknown) => {
  const stringified = new WeakSet<object>();
  return JSON.stringify(
    value,
    (_, value) => {
      if (value === undefined) {
        return "Symbol(undefined)";
      }
      if (typeof value === "object" && value !== null) {
        if (stringified.has(value)) {
          return "Symbol(Circular reference)";
        }
        stringified.add(value);
      }
      return value;
    },
    2
  );
};
