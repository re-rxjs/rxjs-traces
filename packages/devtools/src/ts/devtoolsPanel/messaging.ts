import { shareLatest } from "react-rxjs"
import { BehaviorSubject, combineLatest, Observable, Subject } from "rxjs"
import { filter, map, scan, share, startWith } from "rxjs/operators"
import { ActionHistory, TagState } from "../background"
import { deserialize } from "./deserialize"
import { incremental } from "./operators/incremental"

export const copy$ = new Subject<string>()

const backgroundScriptConnection$ = new Observable<{
  actionHistory?: ActionHistory
  tags?: TagState
}>((obs) => {
  var backgroundPageConnection = chrome.runtime.connect({
    name: "devtools-page_" + chrome.devtools.inspectedWindow.tabId,
  })

  backgroundPageConnection.onMessage.addListener((message) => {
    obs.next(deserialize(message))
  })

  const copySubscription = copy$.subscribe((payload) => {
    backgroundPageConnection.postMessage({
      type: "copy",
      payload,
    })
  })

  return () => {
    backgroundPageConnection.disconnect()
    copySubscription.unsubscribe()
  }
}).pipe(share())

const actionHistory$ = backgroundScriptConnection$.pipe(
  filter((v) => Boolean(v.actionHistory)),
  map((v) => v.actionHistory!),
  startWith([] as ActionHistory),
  shareLatest(),
)

export const tagState$ = backgroundScriptConnection$.pipe(
  filter((v) => Boolean(v.tags)),
  map((v) => v.tags!),
  startWith({} as TagState),
  shareLatest(),
)

type Action = ActionHistory extends Array<infer R> ? R : never

export const slice$ = new BehaviorSubject<number | null>(null)

export const incrementalHistory$ = combineLatest(actionHistory$, slice$).pipe(
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
