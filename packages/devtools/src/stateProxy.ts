import { ReplaySubject } from "rxjs";
import { switchMap } from "rxjs/operators";
import { State } from "./state";

const state$ = new ReplaySubject<State>(1);

export const connectState = (state: State) => state$.next(state);

export const tagValueHistoryById$: State["tagValueHistoryById$"] = (
  id: string
) => state$.pipe(switchMap((v) => v.tagValueHistoryById$(id)));

export const tagDefById$: State["tagDefById$"] = (id: string) =>
  state$.pipe(switchMap((v) => v.tagDefById$(id)));

export const tagId$ = state$.pipe(switchMap((v) => v.tagId$));
