import { defer, Observable, isObservable, Subscription } from 'rxjs';
import { finalize, tap } from 'rxjs/operators';
import { v4 as uuid } from 'uuid';
import {
  newTag$,
  tagSubscription$,
  tagUnsubscription$,
  tagValueChange$,
} from './changes';
import { getMetadata } from './metadata';
import { isPatched } from './patchObservable';

let warningShown = false;
export const addDebugTag = (label: string, id = label) => <T>(
  source: Observable<T>
) => {
  newTag$.next({
    id,
    label,
  });

  const childRefs = new Set<string>();
  childRefs.add(id);

  const result = defer(() => {
    if (!isPatched(source.constructor) && !warningShown) {
      console.warn(
        `addDebugTag is used without Observable being patched. Refs won't be detected`
      );
      warningShown = true;
    }
    const sid = uuid();

    tagSubscription$.next({
      id,
      sid,
    });

    let innerSubscription: Subscription | null = null;
    return source.pipe(
      tap((value) => {
        if (innerSubscription) {
          innerSubscription.unsubscribe();
        }
        if (value instanceof Map) {
          const entries = Array.from(value.entries());
          if (entries.length && entries.every(([, v]) => isObservable(v))) {
            const latestValues = new Map();
            let initialised = false;
            innerSubscription = new Subscription();
            entries.forEach(([key, observable]: [string, Observable<any>]) => {
              innerSubscription?.add(
                observable.subscribe((v) => {
                  latestValues.set(key, v);
                  if (initialised) {
                    tagValueChange$.next({
                      id,
                      sid,
                      value: latestValues,
                    });
                  }
                })
              );
            });
            initialised = true;
            tagValueChange$.next({
              id,
              sid,
              value: latestValues,
            });
            return;
          }
        }
        tagValueChange$.next({
          id,
          sid,
          value,
        });
      }),
      finalize(() => {
        tagUnsubscription$.next({ id, sid });
      })
    );
  });

  const metadata = getMetadata(result);
  metadata.tag = id;

  return result;
};
