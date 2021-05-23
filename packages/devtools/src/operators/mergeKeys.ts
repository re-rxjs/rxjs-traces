import { Observable, Subscription } from "rxjs";
import { skip } from "rxjs-traces";

export const mergeKeys = <K, T>(
  keys$: Observable<Array<K> | Set<K>>,
  getInner$: (key: K) => Observable<T>
): Observable<T> => {
  const result = new Observable<T>((observer) => {
    const innerSubscriptions = new Map<K, Subscription>();

    const subscription = keys$.subscribe(
      (nextKeysArr) => {
        const nextKeys = new Set(nextKeysArr);
        innerSubscriptions.forEach((sub, key) => {
          if (!nextKeys.has(key)) {
            sub.unsubscribe();
            innerSubscriptions.delete(key);
          } else {
            nextKeys.delete(key);
          }
        });
        nextKeys.forEach((key) => {
          innerSubscriptions.set(
            key,
            getInner$(key).subscribe(
              (x) => {
                observer.next(x);
              },
              (e) => {
                observer.error(e);
              }
            )
          );
        });
      },
      (e) => {
        observer.error(e);
      },
      () => {
        observer.complete();
      }
    );

    return () => {
      subscription.unsubscribe();
      innerSubscriptions.forEach((sub) => {
        sub.unsubscribe();
      });
    };
  });
  return skip(result);
};
