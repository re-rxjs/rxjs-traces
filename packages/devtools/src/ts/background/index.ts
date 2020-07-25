import { ReplaySubject } from "rxjs"
import type { DebugTag } from "rxjs-traces"
import { filter, map } from "rxjs/operators"

const tagValue$ = new ReplaySubject<{
  tabId: number
  tagValues: Record<string, DebugTag>
}>(1)

chrome.runtime.onMessage.addListener(function(message, sender) {
  if (sender.tab && sender.tab.id && message.type === "rxjs-traces") {
    tagValue$.next({
      tabId: sender.tab.id,
      tagValues: message.payload,
    })
  }
})

chrome.runtime.onConnect.addListener(function(devToolsConnection) {
  if (!devToolsConnection.name.startsWith("devtools-page_")) {
    return
  }

  const toolsTabId = Number(devToolsConnection.name.split("_")[1])
  const subscription = tagValue$
    .pipe(
      filter(({ tabId }) => tabId === toolsTabId),
      map(({ tagValues }) => tagValues),
    )
    .subscribe(value => devToolsConnection.postMessage(value))

  devToolsConnection.onMessage.addListener(message => {
    console.log("received message", message)
    if (typeof message === "object" && message.type === "copy") {
      document.addEventListener(
        "copy",
        e => {
          if (!e.clipboardData) {
            console.error("no clipboard data")
            return
          }
          e.clipboardData.setData("text/plain", message.payload)
          e.preventDefault()
        },
        { once: true },
      )
      document.execCommand("copy")
    }
  })

  devToolsConnection.onDisconnect.addListener(function() {
    subscription.unsubscribe()
  })
})
