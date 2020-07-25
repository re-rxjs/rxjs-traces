import { merge, Observable, Subject, Subscription } from 'rxjs';
import {
  distinctUntilChanged,
  map,
  scan,
  startWith,
  publish,
  tap,
} from 'rxjs/operators';
import { mapWithoutChildRef, Patched } from './patchObservable';
import { Refs, valueIsWrapped } from './wrappedValue';
import { v4 as uuid } from 'uuid';
import { prepareForTransmit } from './prepareForTransmit';

export const newTag$ = new Subject<{
  id: string;
  label: string;
}>();

export const tagSubscription$ = new Subject<{
  id: string;
  sid: string;
}>();

export const tagUnsubscription$ = new Subject<{
  id: string;
  sid: string;
}>();

export const tagValueChange$ = new Subject<{
  id: string;
  sid: string;
  value: any;
}>();

export const tagRefDetection$ = new Subject<{
  id: string;
  ref: string;
}>();

const tagReset$ = new Subject<void>();

export interface DebugTag {
  id: string;
  label: string;
  refs: string[];
  latestValues: Record<string, any>;
}

const mergeReducer = <T>(
  initialValue: T,
  reducer: (state: T, action: { index: number; value: any }) => T,
  ...observables: Observable<any>[]
) =>
  merge(
    ...observables.map((obs, index) =>
      obs.pipe(map((value) => ({ index, value })))
    )
  ).pipe(
    scan(reducer, initialValue),
    startWith(initialValue),
    distinctUntilChanged()
  );

export const tagValue$: Observable<Record<string, DebugTag>> = mergeReducer<
  Record<string, DebugTag>
>(
  {},
  (state, { index, value }): Record<string, DebugTag> => {
    switch (index) {
      case 0: // reset
        return {};
      case 1: // newTag
        if (state[value.id]) {
          return state;
        }
        return {
          ...state,
          [value.id]: {
            ...value,
            refs: [],
            latestValues: {},
          },
        };
      case 2: // tagSubscription
        return {
          ...state,
          [value.id]: {
            ...state[value.id],
            latestValues: {
              ...state[value.id].latestValues,
              [value.sid]: undefined,
            },
          },
        };
      case 3: // tagUnsubscription
        const { [value.sid]: _, ...latestValues } = state[
          value.id
        ].latestValues;
        return {
          ...state,
          [value.id]: {
            ...state[value.id],
            latestValues,
          },
        };
      case 4: // tagValueChanged
        const values = {
          ...state[value.id].latestValues,
        };
        if (values[value.sid] === value.value) {
          return state;
        }
        values[value.sid] = value.value;
        return {
          ...state,
          [value.id]: {
            ...state[value.id],
            latestValues: values,
          },
        };
      case 5: // tagRefDetection
        if (state[value.id].refs.includes(value.ref)) {
          return state;
        }
        return {
          ...state,
          [value.id]: {
            ...state[value.id],
            refs: [...state[value.id].refs, value.ref],
          },
        };
    }
    return state;
  },
  tagReset$,
  newTag$,
  tagSubscription$,
  tagUnsubscription$,
  tagValueChange$,
  tagRefDetection$
).pipe(publish());
(tagValue$ as any).connect();

let extensionSubscription: Subscription | null = null;
window.addEventListener('message', (event: MessageEvent) => {
  const { data, origin } = event;

  if (origin !== window.location.origin) {
    return;
  }

  if (
    data &&
    typeof data === 'object' &&
    data.source === 'rxjs-traces-bridge' &&
    data.type === 'receive'
  ) {
    if (extensionSubscription) {
      extensionSubscription.unsubscribe();
    }
    extensionSubscription = tagValue$.subscribe((payload) => {
      window.postMessage(
        {
          source: 'rxjs-traces-bridge',
          payload: prepareForTransmit(payload),
        },
        window.location.origin
      );
    });
  }
});
window.postMessage(
  {
    source: 'rxjs-traces-bridge',
    type: 'connected',
  },
  window.location.origin
);

// Internal (just to reset tests);
export const resetTag$ = () => tagReset$.next();

export const addDebugTag = (label: string, id = label) => <T>(
  source: Observable<T>
) => {
  newTag$.next({
    id,
    label,
  });

  const childRefs = new Set<string>();
  childRefs.add(id);

  let warningShown = false;
  const result = source.pipe(
    mapWithoutChildRef((v) => {
      const { value, valueRefs } = valueIsWrapped(v)
        ? {
            value: v.value,
            valueRefs: v[Refs],
          }
        : {
            value: v,
            valueRefs: undefined,
          };

      if (valueRefs) {
        valueRefs.forEach((ref) =>
          tagRefDetection$.next({
            id,
            ref,
          })
        );
      }

      if (!(source as any)[Patched]) {
        if (!warningShown)
          console.warn(
            'rxjs-debugger: You are using `addDebugTag("' +
              label +
              '")` operator without calling `patchObservable` first'
          );
        warningShown = true;
        return value;
      }
      return {
        value,
        [Refs]: childRefs,
      };
    })
  ) as any;
  result.isDebugTag = true;
  return (result as Observable<T>).pipe(
    (source) =>
      new Observable<T>((obs) => {
        const sid = uuid();

        tagSubscription$.next({
          id,
          sid,
        });

        const sub = source
          .pipe(
            tap((value) => {
              tagValueChange$.next({
                id,
                sid,
                value,
              });
            })
          )
          .subscribe(obs);
        return () => {
          tagUnsubscription$.next({ id, sid });
          sub.unsubscribe();
        };
      })
  );
};
