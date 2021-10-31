import { partitionByKey } from "@react-rxjs/utils";
import { Observable, Subject } from "rxjs";
import { TagDef, TagState, connectState } from "rxjs-traces-devtools";
import { filter, map, mergeMap, share, takeWhile } from "rxjs/operators";
import { deserialize } from "./deserialize";

export const copy$ = new Subject<string>();

const backgroundScriptConnection$ = new Observable<{
  tagId$?: string[];
  tagDef$?: Record<string, TagDef>;
  tagValueHistory$?: Record<string, TagState[]>;
}>((obs) => {
  const backgroundPageConnection = chrome.runtime.connect({
    name: "devtools-page_" + chrome.devtools.inspectedWindow.tabId,
  });

  backgroundPageConnection.onMessage.addListener((message) => {
    obs.next(deserialize(message));
  });

  const copySubscription = copy$.subscribe((payload) => {
    backgroundPageConnection.postMessage({
      type: "copy",
      payload,
    });
  });

  return () => {
    backgroundPageConnection.disconnect();
    copySubscription.unsubscribe();
  };
}).pipe(share());

const unwrapPartitionedStream = <R>(stream: Observable<Record<string, R>>) =>
  partitionByKey(
    stream.pipe(mergeMap((value) => Object.entries(value))),
    ([key]) => key,
    (stream$) =>
      stream$.pipe(
        map(([, value]) => value),
        takeWhile((value) => value !== undefined)
      )
  );

const [tagDefById$, tagDefKeys$] = unwrapPartitionedStream(
  backgroundScriptConnection$.pipe(
    filter((v) => Boolean(v.tagDef$)),
    map((v) => v.tagDef$!)
  )
);
tagDefKeys$.subscribe();
const [tagValueHistoryById$, tagValueHistoryKeys$] = unwrapPartitionedStream(
  backgroundScriptConnection$.pipe(
    filter((v) => Boolean(v.tagValueHistory$)),
    map((v) => v.tagValueHistory$!)
  )
);
tagValueHistoryKeys$.subscribe();

connectState({
  tagId$: backgroundScriptConnection$.pipe(
    filter((v) => Boolean(v.tagId$)),
    map((v) => v.tagId$!)
  ),
  tagDefById$,
  tagValueHistoryById$,
});
