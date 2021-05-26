const Patched = Symbol("patched");
export const isPatched = (fn: object) => Boolean(fn && (fn as any)[Patched]);
export const markAsPatched = (fn: object, patched = true) => {
  (fn as any)[Patched] = patched;
};
