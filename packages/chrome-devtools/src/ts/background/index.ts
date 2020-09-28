import { createTabState } from "./tabState"
import { Action } from "rxjs-traces-devtools"
import { take } from "rxjs/operators"

const tabStates = {} as Record<string, ReturnType<typeof createTabState>>

chrome.runtime.onMessage.addListener(function (message, sender) {
  if (sender.tab && sender.tab.id) {
    if (!(sender.tab.id in tabStates)) {
      tabStates[sender.tab.id] = createTabState()
    }
    switch (message.type) {
      case "reset":
        return tabStates[sender.tab.id].reset$.next(message.payload)
      case "new-tag":
        return tabStates[sender.tab.id].newTag$.next(message.payload)
      case "tag-subscription":
        return tabStates[sender.tab.id].tagSubscription$.next(message.payload)
      case "tag-unsubscription":
        return tabStates[sender.tab.id].tagUnsubscription$.next(message.payload)
      case "tag-value-change":
        return tabStates[sender.tab.id].tagValueChange$.next(message.payload)
      case "tag-ref-detection":
        return tabStates[sender.tab.id].tagRefDetection$.next(message.payload)
    }
  }
})

chrome.runtime.onConnect.addListener(function (devToolsConnection) {
  if (!devToolsConnection.name.startsWith("devtools-page_")) {
    return
  }

  const toolsTabId = Number(devToolsConnection.name.split("_")[1])
  if (!(toolsTabId in tabStates)) {
    tabStates[toolsTabId] = createTabState()
  }

  const tagsSub = tabStates[toolsTabId].tag$.subscribe((value) =>
    devToolsConnection.postMessage({
      tags: value,
    }),
  )
  tabStates[toolsTabId].actionHistory$
    .pipe(take(1))
    .subscribe((value: Action[]) =>
      devToolsConnection.postMessage({
        actionHistory: value,
      }),
    )
  const resetSub = tabStates[toolsTabId].reset$.subscribe(() =>
    devToolsConnection.postMessage({
      actionHistory: [],
    }),
  )
  const actionSub = tabStates[toolsTabId].action$.subscribe((value: Action) =>
    devToolsConnection.postMessage({
      action: value,
    }),
  )

  devToolsConnection.onMessage.addListener((message) => {
    if (typeof message === "object" && message.type === "copy") {
      document.addEventListener(
        "copy",
        (e) => {
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

  devToolsConnection.onDisconnect.addListener(function () {
    tagsSub.unsubscribe()
    resetSub.unsubscribe()
    actionSub.unsubscribe()
  })
})
