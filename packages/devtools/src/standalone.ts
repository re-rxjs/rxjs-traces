import { Subject } from "rxjs";
import { skip } from "rxjs-traces";
import { createState } from "./state";
import { connectState } from "./stateProxy";

export const connectStandalone = () => {
  const newTag$ = skip(
    new Subject<{
      id: string;
      label: string;
    }>()
  );

  const tagSubscription$ = skip(
    new Subject<{
      id: string;
      sid: string;
    }>()
  );

  const tagUnsubscription$ = skip(
    new Subject<{
      id: string;
      sid: string;
    }>()
  );

  const tagValueChange$ = skip(
    new Subject<
      Array<{
        id: string;
        sid: string;
        value: any;
      }>
    >()
  );

  const tagRefDetection$ = skip(
    new Subject<{
      id: string;
      ref: string;
    }>()
  );

  const requestMessages = () => {
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

    function consumeEvent(evt: any) {
      switch (evt.type) {
        case "newTag$":
          return newTag$.next(evt.payload);
        case "tagSubscription$":
          return tagSubscription$.next(evt.payload);
        case "tagUnsubscription$":
          return tagUnsubscription$.next(evt.payload);
        case "tagValueChange$":
          return tagValueChange$.next(evt.payload);
        case "tagRefDetection$":
          return tagRefDetection$.next(evt.payload);
      }
    }

    if (typeof data === "object" && data.source === "rxjs-traces") {
      if (data.type === "connected") {
        historyReceived = false;
        requestMessages();
      } else if (!historyReceived && data.type === "event-history") {
        historyReceived = true;
        data.payload.forEach(consumeEvent);
      } else {
        if (historyReceived) {
          consumeEvent(data);
        }
      }
    }
  };

  const state = createState({
    newTag$,
    tagSubscription$,
    tagUnsubscription$,
    tagValueChange$,
    tagRefDetection$,
  });

  connectState(state);

  window.addEventListener("message", handleMessage, false);
  requestMessages();

  return state;
};
