import { Subject } from "rxjs"
import { Action, connect } from "rxjs-traces-devtools"
import { scan, shareReplay } from "rxjs/operators"

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

  const { tag$, action$ } = connect({
    reset$,
    newTag$,
    tagSubscription$,
    tagUnsubscription$,
    tagValueChange$,
    tagRefDetection$,
  })

  const tagReplay$ = tag$.pipe(shareReplay(1))
  const historyReplay$ = action$.pipe(
    scan((history, action) => [...history, action], [] as Action[]),
    shareReplay(1),
  )

  const subscription = tagReplay$.subscribe()
  subscription.add(historyReplay$.subscribe())

  return {
    reset$,
    newTag$,
    tagSubscription$,
    tagUnsubscription$,
    tagValueChange$,
    tagRefDetection$,
    tag$: tagReplay$,
    action$,
    actionHistory$: historyReplay$,
    dispose: () => subscription.unsubscribe(),
  }
}
