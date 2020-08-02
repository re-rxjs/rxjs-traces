import { merge, Observable, ReplaySubject, Subject } from 'rxjs';
import {
  distinctUntilChanged,
  map,
  publish,
  scan,
  startWith,
} from 'rxjs/operators';

export const newTag$ = new ReplaySubject<{
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
      obs.pipe(map(value => ({ index, value })))
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

// Internal (just to reset tests);
export const resetTag$ = () => tagReset$.next();
