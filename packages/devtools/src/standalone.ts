import { Subject } from "rxjs"
import { connect } from "./connect"
import { actionHistory$, tagState$ } from "./messaging"

export const connectStandalone = () => {
  const reset$ = new Subject<void>()

  const newTag$ = new Subject<{
    id: string
    label: string
  }>()

  const tagSubscription$ = new Subject<{
    id: string
    sid: string
  }>()

  const tagUnsubscription$ = new Subject<{
    id: string
    sid: string
  }>()

  const tagValueChange$ = new Subject<{
    id: string
    sid: string
    value: any
  }>()

  const tagRefDetection$ = new Subject<{
    id: string
    ref: string
  }>()

  const requestMessages = () => {
    reset$.next()
    window.postMessage(
      {
        source: "rxjs-traces-devtools",
        type: "receive",
      },
      window.location.origin,
    )
  }

  let historyReceived = false
  const handleMessage = (event: MessageEvent) => {
    const { data, origin } = event

    if (origin !== window.location.origin) {
      return
    }

    function consumeEvent(evt: any) {
      switch (evt.type) {
        case "reset":
          return reset$.next(evt.payload)
        case "new-tag":
          return newTag$.next(evt.payload)
        case "tag-subscription":
          return tagSubscription$.next(evt.payload)
        case "tag-unsubscription":
          return tagUnsubscription$.next(evt.payload)
        case "tag-value-change":
          return tagValueChange$.next(evt.payload)
        case "tag-ref-detection":
          return tagRefDetection$.next(evt.payload)
      }
    }

    if (typeof data === "object" && data.source === "rxjs-traces") {
      if (data.type === "connected") {
        reset$.next()
        historyReceived = false
        requestMessages()
      } else if (!historyReceived && data.type === "event-history") {
        historyReceived = true
        data.payload.forEach(consumeEvent)
      } else {
        if (historyReceived) {
          consumeEvent(data)
        }
      }
    }
  }

  const streams = connect({
    reset$,
    newTag$,
    tagSubscription$,
    tagUnsubscription$,
    tagValueChange$,
    tagRefDetection$,
  })
  streams.actionHistory$.subscribe(actionHistory$)
  streams.tag$.subscribe(tagState$)

  window.addEventListener("message", handleMessage, false)
  requestMessages()
}
