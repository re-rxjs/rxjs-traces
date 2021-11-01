const requestMessages = () => {
  chrome.runtime.sendMessage({
    type: "reset",
  });
  window.postMessage(
    {
      source: "rxjs-traces-devtools",
      type: "receive",
    },
    window.location.origin
  );
};

let historyReceived = false;

const handleMessage = (event: MessageEvent) => {
  const { data, origin } = event;

  if (origin !== window.location.origin) {
    return;
  }

  if (typeof data === "object" && data.source === "rxjs-traces") {
    if (data.type === "connected") {
      historyReceived = false;
      requestMessages();
    } else if (!historyReceived && data.type === "event-history") {
      historyReceived = true;
      data.payload.forEach((evt: any) =>
        chrome.runtime.sendMessage({
          source: "rxjs-traces",
          ...evt,
        })
      );
    } else {
      if (historyReceived) {
        chrome.runtime.sendMessage(data);
      }
    }
  }
};

window.addEventListener("message", handleMessage, false);
requestMessages();

chrome.runtime.connect().onDisconnect.addListener(function () {
  window.removeEventListener("message", handleMessage);
});
