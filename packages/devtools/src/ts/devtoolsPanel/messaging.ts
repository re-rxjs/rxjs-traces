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

interface Snapshot {
  tags: Array<{ id: string; label: string }>
  refs: Array<{ id: string; ref: string }>
  subscriptions: Array<{ id: string; sid: string; value: any }>
}
const snapshotCache: Array<Snapshot> = []
const SNAPSHOT_EVERY = 500

const getSnapshot = (history: ActionHistory, index: number): Snapshot => {
  if (snapshotCache[index]) {
    return snapshotCache[index]
  }
  const previousSnapshot: Snapshot =
    index > 0
      ? getSnapshot(history, index - 1)
      : {
          tags: [],
          refs: [],
          subscriptions: [],
        }

  const tags = [...previousSnapshot.tags]
  const refs = [...previousSnapshot.refs]
  const subscriptions: Map<string, Map<string, any>> = new Map()
  const initSubscriptions = (id: string) => {
    if (!subscriptions.has(id)) {
      subscriptions.set(id, new Map())
    }
  }
  previousSnapshot.subscriptions.forEach(({ id, sid, value }) => {
    initSubscriptions(id)
    subscriptions.get(id)!.set(sid, value)
  })

  for (let i = 0; i < SNAPSHOT_EVERY; i++) {
    const action = history[SNAPSHOT_EVERY * index + i]
    switch (action.type) {
      case "newTag$":
        if (!tags.find((tag) => tag.id === action.payload.id)) {
          tags.push(action.payload)
        }
        break
      case "tagRefDetection$":
        refs.push(action.payload)
        break
      case "tagSubscription$":
        initSubscriptions(action.payload.id)
        subscriptions.get(action.payload.id)!.set(action.payload.sid, undefined)
        break
      case "tagUnsubscription$":
        initSubscriptions(action.payload.id)
        subscriptions.get(action.payload.id)!.delete(action.payload.sid)
        if (subscriptions.get(action.payload.id)!.size === 0) {
          subscriptions.delete(action.payload.id)
        }
        break
      case "tagValueChange$":
        initSubscriptions(action.payload.id)
        subscriptions
          .get(action.payload.id)!
          .set(action.payload.sid, action.payload.value)
        break
    }
  }

  const result: Snapshot = {
    tags,
    refs,
    subscriptions: Array.from(subscriptions.entries()).flatMap(([id, subs]) =>
      Array.from(subs.entries()).map(([sid, value]) => ({
        id,
        sid,
        value,
      })),
    ),
  }
  snapshotCache[index] = result
  return result
}
const getHistorySlice = (history: ActionHistory, index: number | null) => {
  snapshotCache.length = Math.min(
    snapshotCache.length,
    Math.floor(history.length / SNAPSHOT_EVERY),
  )

  if (index === null || index > history.length) {
    index = history.length
  }

  const snapshotIdx = Math.floor(index / SNAPSHOT_EVERY) - 1
  if (snapshotIdx === -1) {
    return index === history.length ? history : history.slice(0, index)
  }
  const snapshot = getSnapshot(history, snapshotIdx)
  const snapshotHistory: ActionHistory = [
    ...snapshot.tags.map<Action>(({ id, label }) => ({
      type: "newTag$",
      payload: {
        id,
        label,
      },
    })),
    ...snapshot.refs.map<Action>(({ id, ref }) => ({
      type: "tagRefDetection$",
      payload: {
        id,
        ref,
      },
    })),
    ...snapshot.subscriptions.map<Action>(({ id, sid }) => ({
      type: "tagSubscription$",
      payload: {
        id,
        sid,
      },
    })),
    ...snapshot.subscriptions.map<Action>(({ id, sid, value }) => ({
      type: "tagValueChange$",
      payload: {
        id,
        sid,
        value,
      },
    })),
  ]
  return [
    ...snapshotHistory,
    ...history.slice((snapshotIdx + 1) * SNAPSHOT_EVERY, index),
  ]
}

export const incrementalHistory$ = combineLatest(actionHistory$, slice$).pipe(
  map(([history, index]) => getHistorySlice(history, index)),
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
