import { Observable } from "rxjs";
import { addDebugTag } from "./debugTag";

const randomId = () => {
  return Math.random().toString(36).substr(2);
};

export function wrapReactRxjs(expression: unknown, name: string) {
  if (typeof expression === "object" && expression instanceof Observable) {
    return expression.pipe(addDebugTag(name, `${name} (bind)`));
  }
  if (typeof expression === "function") {
    return (...args: any) =>
      expression(...args).pipe(
        addDebugTag(name, `${name}#${randomId()} (bind)`)
      );
  }
  return expression;
}
