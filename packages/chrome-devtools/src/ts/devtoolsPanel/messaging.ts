import { Observable, Subject } from "rxjs"
import {
  actionHistory$,
  tagState$,
  ActionHistory,
  TagState,
} from "rxjs-traces-devtools"
import { filter, map, share, startWith } from "rxjs/operators"
import { deserialize } from "./deserialize"

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

backgroundScriptConnection$
  .pipe(
    filter((v) => Boolean(v.actionHistory)),
    map((v) => v.actionHistory!),
    startWith([] as ActionHistory),
  )
  .subscribe(actionHistory$)

backgroundScriptConnection$
  .pipe(
    filter((v) => Boolean(v.tags)),
    map((v) => v.tags!),
    startWith({} as TagState),
  )
  .subscribe(tagState$)
