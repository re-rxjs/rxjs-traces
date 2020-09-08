import { BehaviorSubject, combineLatest } from "rxjs"
import { filter, map, scan, startWith } from "rxjs/operators"
import { incremental } from "./operators/incremental"
import { TagState, ActionHistory } from "connect"

export const actionHistory$ = new BehaviorSubject<ActionHistory>([])

export const tagState$ = new BehaviorSubject<TagState>({})

export const slice$ = new BehaviorSubject<number | null>(null)

export const incrementalHistory$ = combineLatest(actionHistory$, slice$).pipe(
  map(([history, index]) =>
    index === null ? history : history.slice(0, index),
  ),
  incremental(),
)

const tagValueReducer = (
  state: Record<string, any>,
  action: ActionHistory extends Array<infer R> ? R : never,
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

export const tagValue$ = (id: string) =>
  incrementalHistory$.pipe(
    filter((action) => {
      if (action.type === "reset") {
        return true
      }
      const { type, payload } = action.payload
      const interestingTypes: typeof type[] = [
        "tagSubscription$",
        "tagUnsubscription$",
        "tagValueChange$",
      ]
      return payload.id === id && interestingTypes.includes(type)
    }),
    scan((state, action) => {
      if (action.type === "reset") {
        return {}
      }
      return tagValueReducer(state, action.payload)
    }, {} as Record<string, any>),
  )

export const tagInfo$ = (id: string) => tagState$.pipe(map((v) => v[id]))

export const historyLength$ = actionHistory$.pipe(
  map((history) => history.length),
  startWith(0),
)
