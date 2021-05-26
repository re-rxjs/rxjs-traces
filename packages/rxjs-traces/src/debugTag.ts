import { defer, Observable } from "rxjs";
import { finalize, tap } from "rxjs/operators";
import { v4 as uuid } from "uuid";
import {
  newTag$,
  tagRefDetection$,
  tagSubscription$,
  tagUnsubscription$,
  tagValueChange$,
} from "./changes";
import { getMetadata } from "./metadata";
import { isPatched } from "./patched";

let warningShown = false;
export const addDebugTag =
  <T>(label: string, id = label) =>
  (source: Observable<T>) => {
    newTag$.next({
      id,
      label,
    });

    const childRefs = new Set<string>();
    childRefs.add(id);

    const result = defer(() => {
      if (!isPatched(source) && !warningShown) {
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

      return source.pipe(
        tap((value) => {
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
    metadata.setTag(id);
    metadata
      .getDependencies$()
      .subscribe((ref) => tagRefDetection$.next({ id, ref }));

    return result;
  };
