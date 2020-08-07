import { mergeWithKey } from "@josepot/rxjs-utils"
import { shareLatest } from "react-rxjs"
import { Observable, Subject } from "rxjs"
import {
  distinctUntilChanged,
  filter,
  map,
  scan,
  startWith,
  switchMap,
} from "rxjs/operators"

export const createTabState = () => {
  const reset$ = new Subject<void>()

  const newTag$ = new Subject<{
    id: string
    label: string
  }>()

  const tagSubscription$ = new Subject<{
    id: string
    sid: string
  }>()

  const tagUnsubscription$ = new Subject<{
    id: string
    sid: string
  }>()

  const tagValueChange$ = new Subject<{
    id: string
    sid: string
    value: any
  }>()

  const tagRefDetection$ = new Subject<{
    id: string
    ref: string
  }>()

  const distinctTagRefDetection$ = reset$.pipe(
    startWith(undefined),
    switchMap(() =>
      tagRefDetection$.pipe(
        scan(
          (acc, newRef) => {
            const { id, ref } = newRef
            if (id in acc.refs && acc.refs[id].has(ref)) {
              return {
                refs: acc.refs,
                newRef: null,
              }
            }
            acc.refs[id] = acc.refs[id] || new Set()
            acc.refs[id].add(ref)
            return {
              refs: acc.refs,
              newRef,
            }
          },
          {
            refs: {} as Record<string, Set<string>>,
            newRef: null as null | { id: string; ref: string },
          },
        ),
        map((v) => v.newRef!),
        filter((v) => !!v),
      ),
    ),
  )

  const stateAction$ = mergeWithKey({
    newTag$,
    tagRefDetection$: distinctTagRefDetection$,
  })

  const tag$ = reset$.pipe(
    startWith(undefined),
    switchMap(() =>
      stateAction$.pipe(
        scan(
          (tags, action) => {
            const { id } = action.payload
            if (action.type === "newTag$") {
              return id in tags
                ? tags
                : {
                    ...tags,
                    [id]: {
                      ...action.payload,
                      refs: [],
                    },
                  }
            }
            const { ref } = action.payload
            if (!(id in tags) || tags[id].refs.includes(ref)) {
              return tags
            }
            return {
              ...tags,
              [id]: {
                ...tags[id],
                refs: [...tags[id].refs, ref],
              },
            }
          },
          {} as Record<
            string,
            {
              id: string
              label: string
              refs: string[]
            }
          >,
        ),
        distinctUntilChanged(),
      ),
    ),
    shareLatest(),
  )
  tag$.subscribe()

  const action$ = mergeWithKey({
    tagSubscription$,
    tagUnsubscription$,
    tagValueChange$,
  })

  const actionHistory$ = reset$.pipe(
    startWith(undefined),
    switchMap(() =>
      action$.pipe(
        scan(
          (history, value) => [...history, value],
          [] as ObservableValue<typeof action$>[],
        ),
      ),
    ),
    shareLatest(),
  )
  const subscription = actionHistory$.subscribe()

  return {
    reset$,
    newTag$,
    tagSubscription$,
    tagUnsubscription$,
    tagValueChange$,
    tagRefDetection$,
    tag$,
    actionHistory$,
    dispose: () => subscription.unsubscribe(),
  }
}

type ObservableValue<T extends Observable<any>> = T extends Observable<infer R>
  ? R
  : never

export type ActionHistory = ObservableValue<
  ReturnType<typeof createTabState>["actionHistory$"]
>

export type TagState = ObservableValue<
  ReturnType<typeof createTabState>["tag$"]
>
