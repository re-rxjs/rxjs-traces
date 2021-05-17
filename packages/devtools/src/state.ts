import { mergeWithKey, partitionByKey } from "@react-rxjs/utils";
import { Observable } from "rxjs";
import {
  scan,
  map,
  tap,
  share,
  take,
  switchMap,
  startWith,
} from "rxjs/operators";

export interface TagState {
  sequenceNumber: number;
  subscriptions: Record<
    string, // subscription id
    unknown // value
  >;
}

export interface TagDef {
  id: string;
  label: string;
  refs: string[];
}

type WithSeqNum<T extends Observable<unknown>[]> = {
  [K in keyof T]: T[K] extends Observable<infer R>
    ? Observable<{
        sequenceNumber: number;
        payload: R;
      }>
    : never;
};
// Asuming args are hot
function withSequenceNumber<T extends Observable<unknown>[]>(
  ...args: T
): WithSeqNum<T> {
  let sequenceNumber = 0;

  return args.map((obs) =>
    obs.pipe(
      map((payload) => ({
        sequenceNumber,
        payload,
      })),
      tap(() => {
        sequenceNumber++;
      }),
      share()
    )
  ) as WithSeqNum<T>;
}

export interface State {
  tagValueHistoryById$: (id: string) => Observable<TagState[]>;
  tagDefById$: (id: string) => Observable<TagDef>;
  tagId$: Observable<string[]>;
}

export function createState(input: {
  newTag$: Observable<{
    id: string;
    label: string;
  }>;
  tagSubscription$: Observable<{
    id: string;
    sid: string;
  }>;
  tagUnsubscription$: Observable<{
    id: string;
    sid: string;
  }>;
  tagValueChange$: Observable<{
    id: string;
    sid: string;
    value: any;
  }>;
  tagRefDetection$: Observable<{
    id: string;
    ref: string;
  }>;
}): State {
  const [tagSubscription$, tagUnsubscription$, tagValueChange$] =
    withSequenceNumber(
      input.tagSubscription$,
      input.tagUnsubscription$,
      input.tagValueChange$
    );
  const { newTag$, tagRefDetection$ } = input;

  const tagAction$ = mergeWithKey({
    tagSubscription$,
    tagUnsubscription$,
    tagValueChange$,
  });

  const [tagValueHistoryById$] = partitionByKey(
    tagAction$,
    (action) => action.payload.payload.id,
    (action$) =>
      action$.pipe(
        scan((history, action) => {
          let newValue: TagState = {
            sequenceNumber: action.payload.sequenceNumber,
            subscriptions: history.length
              ? history[history.length - 1].subscriptions
              : {},
          };
          switch (action.type) {
            case "tagSubscription$":
              if (action.payload.payload.sid in newValue.subscriptions) {
                return history;
              }
              newValue.subscriptions = {
                ...newValue.subscriptions,
                [action.payload.payload.sid]: undefined,
              };
              break;
            case "tagUnsubscription$":
              if (!(action.payload.payload.sid in newValue.subscriptions)) {
                return history;
              }
              const { [action.payload.payload.sid]: _, ...newSubscriptions } =
                newValue.subscriptions;
              newValue.subscriptions = newSubscriptions;
              break;
            case "tagValueChange$":
              if (
                newValue.subscriptions[action.payload.payload.sid] ===
                action.payload.payload.value
              ) {
                return history;
              }
              newValue.subscriptions = {
                ...newValue.subscriptions,
                [action.payload.payload.sid]: action.payload.payload.value,
              };
              break;
          }
          return [...history, newValue];
        }, [] as TagState[])
      )
  );

  const [tagRefDetectionById$] = partitionByKey(
    tagRefDetection$,
    (v) => v.id,
    (v) => v
  );
  const [tagDefById$, tagId$] = partitionByKey(
    newTag$,
    (tag) => tag.id,
    (obs$, id) =>
      obs$.pipe(
        take(1),
        switchMap((v) => {
          const initial: TagDef = {
            ...v,
            refs: [],
          };

          return tagRefDetectionById$(id).pipe(
            scan((acc, d) => {
              if (acc.refs.includes(d.ref)) {
                return acc;
              }
              return {
                ...acc,
                refs: [...acc.refs, d.ref],
              };
            }, initial),
            startWith(initial)
          );
        })
      )
  );

  return { tagValueHistoryById$, tagDefById$, tagId$ };
}
