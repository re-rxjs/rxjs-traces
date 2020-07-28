import { shareLatest } from 'react-rxjs'
import { Observable, Subject } from "rxjs"
import { DebugTag } from 'rxjs-traces'
import { map, startWith } from 'rxjs/operators'
import type { ActionHistory } from "../background"
import { deserialize } from "./deserialize"

export const copy$ = new Subject<string>()

const actionHistory$ = new Observable<ActionHistory>(obs => {
  var backgroundPageConnection = chrome.runtime.connect({
    name: "devtools-page_" + chrome.devtools.inspectedWindow.tabId,
  })

  backgroundPageConnection.onMessage.addListener(({ actionHistory }) => {
    obs.next(deserialize(actionHistory))
  })

  const copySubscription = copy$.subscribe(payload => {
    backgroundPageConnection.postMessage({
      type: "copy",
      payload,
    })
  })

  return () => {
    backgroundPageConnection.disconnect()
    copySubscription.unsubscribe()
  }
}).pipe(
  startWith([]),
  shareLatest(),
);

type Action = ActionHistory extends Array<infer R> ? R : never;

const tagStateReducer = (state: Record<string, DebugTag> = {}, action: Action): Record<string, DebugTag> => {
  switch(action.type) {
    case 'newTag$':
      return {
        ...state,
        [action.payload.id]: {
          ...action.payload,
          refs: [],
          latestValues: {},
        },
      };
    case 'tagRefDetection$':
      return {
        ...state,
        [action.payload.id]: {
          ...state[action.payload.id],
          refs: [...state[action.payload.id].refs, action.payload.ref],
        },
      };
    case 'tagSubscription$':
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
    case 'tagUnsubscription$':
      const { [action.payload.sid]: _, ...latestValues } = state[
        action.payload.id
      ].latestValues;
      return {
        ...state,
        [action.payload.id]: {
          ...state[action.payload.id],
          latestValues,
        },
      };
    case 'tagValueChange$':
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
  }
}

export const tagValue$ = (index: number | null) => actionHistory$.pipe(
  map(history => {
    const slice = index === null ? history : history.slice(0, index);
    return slice.reduce(tagStateReducer, {})
  })
);

export const historyLength$ = actionHistory$.pipe(
  map(history => history.length),
  startWith(0)
);
