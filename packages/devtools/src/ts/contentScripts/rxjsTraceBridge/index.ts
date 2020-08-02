const requestMessages = () => {
  chrome.runtime.sendMessage({
    type: "reset",
  })
  window.postMessage(
    {
      source: "rxjs-traces-devtools",
      type: "receive",
    },
    window.location.origin,
  )
}

const handleMessage = (event: MessageEvent) => {
  const { data, origin } = event

  if (origin !== window.location.origin) {
    return
  }

  if (typeof data === "object" && data.source === "rxjs-traces") {
    if (data.type === "connected") {
      chrome.runtime.sendMessage({
        type: "reset",
      })
      requestMessages()
    } else {
      chrome.runtime.sendMessage({
        type: data.type,
        payload: data.payload,
      })
    }
  }
}

window.addEventListener("message", handleMessage, false)
requestMessages()

chrome.runtime.connect().onDisconnect.addListener(function() {
  window.removeEventListener("message", handleMessage)
})
