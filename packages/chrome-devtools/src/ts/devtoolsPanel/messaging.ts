import { EMPTY, Observable, of, Subject } from "rxjs"
import {
  Action,
  action$,
  reset$,
  TagState,
  tagState$,
} from "rxjs-traces-devtools"
import { filter, map, mapTo, mergeMap, share, startWith } from "rxjs/operators"
import { deserialize } from "./deserialize"

export const copy$ = new Subject<string>()

const backgroundScriptConnection$ = new Observable<{
  action?: Action
  actionHistory?: Action[]
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

backgroundScriptConnection$
  .pipe(
    filter((v) => Boolean(v.actionHistory)),
    mapTo(void 0),
  )
  .subscribe(reset$)

backgroundScriptConnection$
  .pipe(
    mergeMap((v) =>
      v.actionHistory ? v.actionHistory : v.action ? of(v.action) : EMPTY,
    ),
  )
  .subscribe(action$)

backgroundScriptConnection$
  .pipe(
    filter((v) => Boolean(v.tags)),
    map((v) => v.tags!),
    startWith({} as TagState),
  )
  .subscribe(tagState$)
