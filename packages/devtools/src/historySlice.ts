import { combineKeys } from "@react-rxjs/utils";
import { BehaviorSubject, combineLatest } from "rxjs";
import { distinctUntilChanged, filter, map } from "rxjs/operators";
import { tagId$, tagValueHistoryById$ } from "./stateProxy";

export const slice$ = new BehaviorSubject<number | null>(null);

export const historyLength$ = combineKeys(tagId$, (id) =>
  tagValueHistoryById$(id).pipe(
    map((v) => v[v.length - 1]?.sequenceNumber),
    filter((v) => v !== undefined)
  )
).pipe(map((v) => Math.max(0, ...Array.from(v.values()))));

export const tagValueById$ = (id: string) =>
  combineLatest({
    slice: slice$,
    tagHistory: tagValueHistoryById$(id),
  }).pipe(
    map(({ slice, tagHistory }) => {
      if (slice === null) {
        return tagHistory[tagHistory.length - 1];
      }
      for (let i = tagHistory.length - 1; i >= 0; i--) {
        if (tagHistory[i].sequenceNumber <= slice) {
          return tagHistory[i];
        }
      }
      return tagHistory[0];
    }),
    distinctUntilChanged(),
    filter((v) => v !== undefined),
    map((v) => v.subscriptions)
  );
