import { mergeWithKey } from "@josepot/rxjs-utils"
import { Observable, Subject } from "rxjs"
import { filter, map, scan, share, startWith, switchMap } from "rxjs/operators"

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

  const action$ = mergeWithKey({
    newTag$,
    tagSubscription$,
    tagUnsubscription$,
    tagValueChange$,
    tagRefDetection$: distinctTagRefDetection$,
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
    share(),
  )
  const subscription = actionHistory$.subscribe()

  return {
    reset$,
    newTag$,
    tagSubscription$,
    tagUnsubscription$,
    tagValueChange$,
    tagRefDetection$,
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
