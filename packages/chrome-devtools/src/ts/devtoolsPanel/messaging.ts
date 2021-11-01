import { partitionByKey } from "@react-rxjs/utils";
import { Observable, ReplaySubject, Subject } from "rxjs";
import { TagDef, TagState, connectState } from "rxjs-traces-devtools";
import { map, mergeMap, takeWhile } from "rxjs/operators";
import { deserialize } from "./deserialize";

export const copy$ = new Subject<string>();

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

const tagIdSubject = new ReplaySubject<string[]>(1);
const tagDefSubject = new Subject<Record<string, TagDef>>();
const tagValueHistorySubject = new Subject<Record<string, TagState[]>>();

const backgroundPageConnection = chrome.runtime.connect({
  name: "devtools-page_" + chrome.devtools.inspectedWindow.tabId,
});

backgroundPageConnection.onMessage.addListener((message) => {
  const [type, payload] = Object.entries(deserialize(message))[0];
  const target =
    type === "tagId$"
      ? tagIdSubject
      : type === "tagDef$"
      ? tagDefSubject
      : tagValueHistorySubject;
  target.next(payload as any);
});

copy$.subscribe((payload) => {
  backgroundPageConnection.postMessage({
    type: "copy",
    payload,
  });
});

const [tagDefById$, tagDefKeys$] = unwrapPartitionedStream(tagDefSubject);
const [tagValueHistoryById$, tagValueHistoryKeys$] = unwrapPartitionedStream(
  tagValueHistorySubject
);

connectState({
  tagId$: tagIdSubject,
  tagDefById$,
  tagValueHistoryById$,
});

tagDefKeys$.subscribe();
tagValueHistoryKeys$.subscribe();

backgroundPageConnection.postMessage({
  type: "ready",
});
