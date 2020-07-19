import { merge, Observable, Subject } from 'rxjs';
import {
  distinctUntilChanged,
  map,
  scan,
  startWith,
  publish,
} from 'rxjs/operators';
import { mapWithoutChildRef, Patched } from './patchObservable';
import { Refs, valueIsWrapped } from './wrappedValue';

export const newTag$ = new Subject<{
  id: string;
  label: string;
}>();

export const tagValueChange$ = new Subject<{
  id: string;
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
  latestValue: any;
}

const mergeReducer = <T>(
  initialValue: T,
  reducer: (state: T, action: { index: number; value: any }) => T,
  ...observables: Observable<any>[]
) =>
  merge(
    ...observables.map((obs, index) =>
      obs.pipe(map(value => ({ index, value })))
    )
  ).pipe(
    scan(reducer, initialValue),
    startWith(initialValue),
    distinctUntilChanged()
  );

export const tagValue$ = mergeReducer<Record<string, DebugTag>>(
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
            latestValue: undefined,
          },
        };
      case 2: // tagValueChanged
        return {
          ...state,
          [value.id]: {
            ...state[value.id],
            latestValue: value.value,
          },
        };
      case 3: // tagRefDetection
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
  tagValueChange$,
  tagRefDetection$
).pipe(publish());
(tagValue$ as any).connect();

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
  return (source.pipe(
    mapWithoutChildRef(v => {
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
        valueRefs.forEach(ref =>
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
  ) as any) as Observable<T>;
};
