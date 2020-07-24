const requestMessages = () => {
  chrome.runtime.sendMessage({
    type: "rxjs-traces",
    payload: {},
  })
  window.postMessage(
    {
      source: "rxjs-traces-bridge",
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

  if (
    data &&
    typeof data === "object" &&
    data.source === "rxjs-traces-bridge"
  ) {
    if (data.type === "connected") {
      requestMessages()
    } else if (data.type !== "receive") {
      chrome.runtime.sendMessage({
        type: "rxjs-traces",
        payload: JSON.parse(data.payload),
      })
    }
  }
}

window.addEventListener("message", handleMessage, false)
requestMessages()

chrome.runtime.connect().onDisconnect.addListener(function () {
  window.removeEventListener("message", handleMessage)
})
