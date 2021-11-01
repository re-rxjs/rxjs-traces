export function deserialize(value: any, visitedValues = new WeakSet<any>()) {
  if (value === "Symbol(undefined)") {
    return undefined;
  }
  if (visitedValues.has(value) || value === null || typeof value !== "object") {
    return value;
  }
  if (Array.isArray(value)) {
    visitedValues.add(value);
    for (let i = 0; i < value.length; i++) {
      value[i] = deserialize(value[i]);
    }
    return value;
  }
  for (const key in value) {
    visitedValues.add(value);
    value[key] = deserialize(value[key]);
  }
  return value;
}
