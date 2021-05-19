import { Observable } from "rxjs";

const originalSubscribe = Observable.prototype.subscribe as any;
export function skip<T extends Observable<unknown>>(obs$: T): T {
  obs$.subscribe = originalSubscribe;
  const originalLift = obs$.lift;
  obs$.lift = (operator) => {
    const result: any = originalLift.call(obs$, operator);
    return skip(result);
  };
  return obs$;
}
