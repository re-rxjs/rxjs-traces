import * as Operators from "rxjs/operators";
import { Observable, Operator, of } from "rxjs";
// @ts-ignore
import * as subscribeToResultModule from 'rxjs/internal/util/subscribeToResult';
import { valueIsWrapped, Refs, WrappedNext } from "./wrappedNext";
const {subscribeToResult} = (subscribeToResultModule as any);

// Keep reference to unpatched operators
const originalSubscribe = Observable.prototype.subscribe;
export const unpatchedMap = <T, R>(mapFn: (value: T) => R) => (
  source$: Observable<T>
): Observable<R> =>
  new Observable((obs) =>
    originalSubscribe.call(source$, {
      next: (value: T) => obs.next(mapFn(value)),
      error: obs.error?.bind(obs),
      complete: obs.complete?.bind(obs),
    })
  );

export const unpatchSubscribe = <T>(observable: Observable<T>) => {
  const newObservable = new Observable<T>((obs) =>
    originalSubscribe.call(observable, obs)
  );
  newObservable.subscribe = (...args: any) =>
    originalSubscribe.call(newObservable, ...args);
  return newObservable;
};

// Patches internal use of subscribe to not unwrap values
// TODO what about ObservableLikes (e.g. Promise)?
(subscribeToResultModule as any).subscribeToResult = (outerSubscriber: any, result: any, ...args: any) => {
  return subscribeToResult(outerSubscriber, unpatchSubscribe(result), ...args);
}

Object.keys(Operators).forEach((operator: any) => {
  const original: Function = (Operators as any)[operator];
  (Operators as any)[operator] = (...args: any[]) => {
    const applied = original(...args);
    const result = function <T>(stream: Observable<T>) {
      const refs = new Set<string>();
      return applied(
        stream.pipe(
          unpatchedMap((v) => {
            if (valueIsWrapped(v)) {
              v[Refs].forEach((ref) => refs.add(ref));
              return v.value;
            }
            return v;
          })
        )
      ).pipe(
        unpatchedMap(
          (value): WrappedNext => {
            if(valueIsWrapped(value)) {
              value[Refs].forEach((ref) => refs.add(ref));
              return {
                value: value.value,
                [Refs]: refs
              }
            }
            return {
              value,
              [Refs]: refs,
            }
          }
        )
      );
    };

    return result;
  };
});

const operatorsWithObservableMap: (keyof typeof Operators)[] = [
  "mergeMap",
  "switchMap",
];
// TODO `mergeMap` is alias of `map` + `mergeAll`. What about those operators?

// operatorsWithObservableMap.forEach((name) => {
//   const originalFn = Operators[name] as any;
//   (Operators as any)[name] = (mapFn: Function, ...args: any) =>
//     //originalFn((value: any) => unpatchSubscribe(mapFn(value)), ...args);
//     originalFn(() => of('ha'))
// });
