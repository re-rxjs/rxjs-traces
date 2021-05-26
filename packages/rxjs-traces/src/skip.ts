import { Observable } from "rxjs";
import { isPatched, markAsPatched } from "./patched";

const originalSubscribe = Observable.prototype.subscribe as any;
export function skip<T extends Observable<unknown>>(obs$: T): T {
  const originalLift = obs$.lift;
  if (isPatched(originalLift)) {
    return obs$;
  }

  obs$.subscribe = originalSubscribe;
  obs$.lift = (operator) => {
    const result: any = originalLift.call(obs$, operator);
    return skip(result);
  };
  markAsPatched(obs$.lift);

  return obs$;
}
