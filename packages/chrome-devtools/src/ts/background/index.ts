import { createTabState } from "./tabState";

// TODO cleanup on tab close
const tabStates = {} as Record<string, ReturnType<typeof createTabState>>;

chrome.runtime.onMessage.addListener(function (message, sender) {
  if (typeof message !== "object" || message.source !== "rxjs-traces") {
    return;
  }
  if (!(sender.tab && sender.tab.id)) {
    return;
  }

  if (!(sender.tab.id in tabStates)) {
    tabStates[sender.tab.id] = createTabState();
  }
  switch (message.type) {
    case "reset":
      tabStates[sender.tab.id].reset();
      break;
    case "newTag$":
      return tabStates[sender.tab.id].newTag$.next(message.payload);
    case "tagSubscription$":
      return tabStates[sender.tab.id].tagSubscription$.next(message.payload);
    case "tagUnsubscription$":
      return tabStates[sender.tab.id].tagUnsubscription$.next(message.payload);
    case "tagValueChange$":
      return tabStates[sender.tab.id].tagValueChange$.next(message.payload);
    case "tagRefDetection$":
      return tabStates[sender.tab.id].tagRefDetection$.next(message.payload);
  }
});

chrome.runtime.onConnect.addListener(function (devToolsConnection) {
  if (!devToolsConnection.name.startsWith("devtools-page_")) {
    return;
  }

  const toolsTabId = Number(devToolsConnection.name.split("_")[1]);
  if (!(toolsTabId in tabStates)) {
    tabStates[toolsTabId] = createTabState();
  }

  let cleanup = () => {};

  devToolsConnection.onMessage.addListener((message) => {
    if (typeof message !== "object") {
      return;
    }
    if (message.type === "ready") {
      let firstRun = true;

      const tagsSub = tabStates[toolsTabId].tagId$.subscribe((value) => {
        devToolsConnection.postMessage({
          tagId$: value,
        });
      });
      const tagDefSub = tabStates[toolsTabId].tagDef$.subscribe((value) => {
        const keysToEval = Array.from(firstRun ? value.keys() : value.changes);
        devToolsConnection.postMessage({
          tagDef$: Object.fromEntries(
            keysToEval.map((key) => [key, value.get(key)])
          ),
        });
      });
      const tagValueHistorySub = tabStates[
        toolsTabId
      ].tagValueHistory$.subscribe((value) => {
        const keysToEval = Array.from(firstRun ? value.keys() : value.changes);
        devToolsConnection.postMessage({
          tagValueHistory$: Object.fromEntries(
            keysToEval.map((key) => [key, value.get(key)])
          ),
        });
      });

      firstRun = false;

      cleanup = () => {
        tagsSub.unsubscribe();
        tagDefSub.unsubscribe();
        tagValueHistorySub.unsubscribe();
      };
    }
    if (message.type === "copy") {
      document.addEventListener(
        "copy",
        (e) => {
          if (!e.clipboardData) {
            console.error("no clipboard data");
            return;
          }
          e.clipboardData.setData("text/plain", message.payload);
          e.preventDefault();
        },
        { once: true }
      );
      document.execCommand("copy");
    }
  });

  devToolsConnection.onDisconnect.addListener(function () {
    cleanup();
  });
});
