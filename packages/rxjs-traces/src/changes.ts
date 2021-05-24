import { mergeWithKey } from "@react-rxjs/utils";
import { Observable, ReplaySubject, Subject } from "rxjs";
import { distinctUntilChanged, scan, share, startWith } from "rxjs/operators";
import { skip } from "./skip";

export const newTag$ = skip(
  new ReplaySubject<{
    id: string;
    label: string;
  }>()
);

export const tagSubscription$ = skip(
  new Subject<{
    id: string;
    sid: string;
  }>()
);

export const tagUnsubscription$ = skip(
  new Subject<{
    id: string;
    sid: string;
  }>()
);

export const tagValueChange$ = skip(
  new Subject<{
    id: string;
    sid: string;
    value: any;
  }>()
);

export const tagRefDetection$ = skip(
  new Subject<{
    id: string;
    ref: string;
  }>()
);

const tagReset$ = skip(new Subject<void>());

export interface DebugTag {
  id: string;
  label: string;
  refs: string[];
  latestValues: Record<string, any>;
}

export const tagValue$: Observable<Record<string, DebugTag>> = skip(
  mergeWithKey({
    tagReset$,
    newTag$,
    tagSubscription$,
    tagUnsubscription$,
    tagValueChange$,
    tagRefDetection$,
  })
).pipe(
  scan((state, action) => {
    switch (action.type) {
      case "tagReset$":
        return {};
      case "newTag$":
        if (state[action.payload.id]) {
          return state;
        }
        return {
          ...state,
          [action.payload.id]: {
            ...action.payload,
            refs: [],
            latestValues: {},
          },
        };
      case "tagSubscription$":
        return {
          ...state,
          [action.payload.id]: {
            ...state[action.payload.id],
            latestValues: {
              ...state[action.payload.id].latestValues,
              [action.payload.sid]: undefined,
            },
          },
        };
      case "tagUnsubscription$":
        const { [action.payload.sid]: _, ...latestValues } =
          state[action.payload.id].latestValues;
        return {
          ...state,
          [action.payload.id]: {
            ...state[action.payload.id],
            latestValues,
          },
        };
      case "tagValueChange$":
        const values = {
          ...state[action.payload.id].latestValues,
        };
        if (values[action.payload.sid] === action.payload.value) {
          return state;
        }
        values[action.payload.sid] = action.payload.value;
        return {
          ...state,
          [action.payload.id]: {
            ...state[action.payload.id],
            latestValues: values,
          },
        };
      case "tagRefDetection$":
        if (state[action.payload.id].refs.includes(action.payload.ref)) {
          return state;
        }
        return {
          ...state,
          [action.payload.id]: {
            ...state[action.payload.id],
            refs: [...state[action.payload.id].refs, action.payload.ref],
          },
        };
    }
    return state;
  }, {} as Record<string, DebugTag>),
  startWith({}),
  distinctUntilChanged(),
  share()
);

tagValue$.subscribe();

// Internal (just to reset tests);
export const resetTag$ = () => tagReset$.next();
