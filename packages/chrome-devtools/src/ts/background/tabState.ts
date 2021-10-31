import { Subject } from "rxjs";
import { createState } from "rxjs-traces-devtools";
import { combineKeys } from "@react-rxjs/utils";

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

  const subscription = tagId$.subscribe();
  // We need to also subscribe to these because the underlying partitionByKey needs to be alive
  subscription.add(tagDef$.subscribe());
  subscription.add(tagValueHistory$.subscribe());

  return {
    newTag$,
    tagSubscription$,
    tagUnsubscription$,
    tagValueChange$,
    tagRefDetection$,
    tagId$,
    tagDef$,
    tagValueHistory$,
    dispose: () => subscription.unsubscribe(),
  };
};
