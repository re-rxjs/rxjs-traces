import { ReplaySubject, Subject } from "rxjs";
import { createState, TagDef, TagState } from "rxjs-traces-devtools";
import { combineKeys, MapWithChanges } from "@react-rxjs/utils";

export const createTabState = () => {
  const newTag$ = new Subject<{
    id: string;
    label: string;
  }>();

  const tagSubscription$ = new Subject<{
    id: string;
    sid: string;
  }>();

  const tagUnsubscription$ = new Subject<{
    id: string;
    sid: string;
  }>();

  const tagValueChange$ = new Subject<
    Array<{
      id: string;
      sid: string;
      value: any;
    }>
  >();

  const tagRefDetection$ = new Subject<{
    id: string;
    ref: string;
  }>();

  const tagIdSubject = new ReplaySubject<string[]>(1);
  const tagDefSubject = new ReplaySubject<MapWithChanges<string, TagDef>>(1);
  const tagValueHistorySubject = new ReplaySubject<
    MapWithChanges<string, TagState[]>
  >(1);

  const makeState = () => {
    const state = createState({
      newTag$,
      tagSubscription$,
      tagUnsubscription$,
      tagValueChange$,
      tagRefDetection$,
    });

    const { tagId$, tagDefById$, tagValueHistoryById$ } = state;
    const tagDef$ = combineKeys(tagId$, tagDefById$);
    const tagValueHistory$ = combineKeys(tagId$, tagValueHistoryById$);

    const subscription = tagId$.subscribe(tagIdSubject);
    // We need to also subscribe to these because the underlying partitionByKey needs to be alive
    subscription.add(tagDef$.subscribe(tagDefSubject));
    subscription.add(tagValueHistory$.subscribe(tagValueHistorySubject));
    return () => subscription.unsubscribe();
  };

  let disposeState = makeState();
  const reset = () => {
    disposeState();
    disposeState = makeState();
  };

  return {
    newTag$,
    tagSubscription$,
    tagUnsubscription$,
    tagValueChange$,
    tagRefDetection$,
    tagId$: tagIdSubject,
    tagDef$: tagDefSubject,
    tagValueHistory$: tagValueHistorySubject,
    reset,
    dispose: () => {
      disposeState();
    },
  };
};
