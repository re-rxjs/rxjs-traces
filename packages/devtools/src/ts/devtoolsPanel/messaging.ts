import { shareLatest } from "react-rxjs"
import {
  BehaviorSubject,
  combineLatest,
  concat,
  EMPTY,
  from,
  Observable,
  of,
  Subject,
} from "rxjs"
import { DebugTag } from "rxjs-traces"
import {
  concatMap,
  filter,
  map,
  pairwise,
  scan,
  startWith,
} from "rxjs/operators"
import type { ActionHistory } from "../background"
import { deserialize } from "./deserialize"

export const copy$ = new Subject<string>()

const actionHistory$ = new Observable<ActionHistory>((obs) => {
  var backgroundPageConnection = chrome.runtime.connect({
    name: "devtools-page_" + chrome.devtools.inspectedWindow.tabId,
  })

  backgroundPageConnection.onMessage.addListener(({ actionHistory }) => {
    obs.next(deserialize(actionHistory))
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
}).pipe(startWith([]), shareLatest())

type Action = ActionHistory extends Array<infer R> ? R : never

const tagStateReducer = (
  state: DebugTag | null,
  action: Action,
): DebugTag | null => {
  if (action.type === "newTag$") {
    return {
      ...action.payload,
      refs: [],
      latestValues: {},
    }
  }
  if (state === null) {
    return null
  }
  switch (action.type) {
    case "tagRefDetection$":
      return {
        ...state,
        refs: [...state.refs, action.payload.ref],
      }
    case "tagSubscription$":
      return {
        ...state,
        latestValues: {
          ...state.latestValues,
          [action.payload.sid]: undefined,
        },
      }
    case "tagUnsubscription$":
      const { [action.payload.sid]: _, ...latestValues } = state.latestValues
      return {
        ...state,
        latestValues,
      }
    case "tagValueChange$":
      const values = {
        ...state.latestValues,
      }
      if (values[action.payload.sid] === action.payload.value) {
        return state
      }
      values[action.payload.sid] = action.payload.value
      return {
        ...state,
        latestValues: values,
      }
  }
}

const empty = Symbol("empty")
const incremental = () => <T>(source: Observable<T[]>) =>
  source.pipe(
    startWith(empty),
    pairwise(),
    concatMap(([previous, next]) => {
      if (!Array.isArray(next)) {
        return EMPTY
      }
      const mapIncremental = map((v: T) => ({
        type: "incremental" as const,
        payload: v,
      }))
      if (previous === empty) {
        return from(next).pipe(mapIncremental)
      }
      if (next.length < previous.length) {
        return concat(
          of({
            type: "reset" as const,
          }),
          from(next).pipe(mapIncremental),
        )
      }
      return from(next.slice(previous.length)).pipe(mapIncremental)
    }),
  )

export const slice$ = new BehaviorSubject<number | null>(null)

export const incrementalHistory$ = combineLatest(actionHistory$, slice$).pipe(
  map(([history, index]) =>
    index === null ? history : history.slice(0, index),
  ),
  incremental(),
)

export const latestTagValue$ = (id: string) =>
  incrementalHistory$.pipe(
    filter((action) => {
      if (action.type === "reset") {
        return true
      }
      const { type, payload } = action.payload
      const interestingTypes: typeof type[] = [
        "newTag$",
        "tagSubscription$",
        "tagUnsubscription$",
        "tagValueChange$",
      ]
      return payload.id === id && interestingTypes.includes(type)
    }),
    scan((state, action) => {
      if (action.type === "reset") {
        return null
      }
      return tagStateReducer(state, action.payload)
    }, null as DebugTag | null),
    filter((v) => v !== null),
    map((v) => v!),
  )

export const historyLength$ = actionHistory$.pipe(
  map((history) => history.length),
  startWith(0),
)
