import { shareLatest } from "@react-rxjs/core"
import { collect, split } from "@react-rxjs/utils"
import { Action, TagState } from "connect"
import { BehaviorSubject, combineLatest, Subject } from "rxjs"
import { filter, map, scan, share, startWith, switchMap } from "rxjs/operators"
import { incremental } from "./operators/incremental"

export const reset$ = new Subject<void>()

export const action$ = new Subject<Action>()

export const tagState$ = new BehaviorSubject<TagState>({})

export const slice$ = new BehaviorSubject<number | null>(null)

const actionHistory$ = reset$.pipe(
  startWith(undefined),
  switchMap(() =>
    action$.pipe(
      scan((history, action) => [...history, action], [] as Action[]),
      startWith([]),
    ),
  ),
  shareLatest(),
)
actionHistory$.subscribe()

export const incrementalHistory$ = combineLatest([actionHistory$, slice$]).pipe(
  map(([history, index]) =>
    index === null ? history : history.slice(0, index),
  ),
  incremental(),
)

const tagValueReducer = (
  state: Record<string, any>,
  action: Action,
): Record<string, any> => {
  switch (action.type) {
    case "tagSubscription$":
      return {
        ...state,
        [action.payload.sid]: undefined,
      }
    case "tagUnsubscription$":
      const { [action.payload.sid]: _, ...newState } = state
      return newState
    case "tagValueChange$":
      if (state[action.payload.sid] === action.payload.value) {
        return state
      }
      const newValues = {
        ...state,
        [action.payload.sid]: action.payload.value,
      }
      return newValues
  }
  return state
}

const incrementReset$ = incrementalHistory$.pipe(
  filter((inc) => inc.type === "reset"),
  share(),
)

export const tagValue$ = incrementReset$.pipe(
  startWith(null),
  switchMap(() =>
    incrementalHistory$.pipe(
      filter((increment) => increment.type === "incremental"),
      map((increment) => {
        if (increment.type !== "incremental") {
          throw null
        }
        return increment.payload
      }),
      split(
        (action) => action.payload.id,
        (action$) => action$.pipe(scan(tagValueReducer, {})),
      ),
      collect(),
    ),
  ),
  shareLatest(),
)

export const tagValueById$ = (id: string) =>
  tagValue$.pipe(
    filter((groups) => groups.has(id)),
    switchMap((groups) => groups.get(id)!),
  )

export const tagInfo$ = (id: string) => tagState$.pipe(map((v) => v[id]))

export const historyLength$ = actionHistory$.pipe(
  map((history) => history.length),
  startWith(0),
)
