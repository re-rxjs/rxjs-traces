import { mergeWithKey } from "@react-rxjs/utils"
import { Observable } from "rxjs"
import { distinctUntilChanged, filter, map, scan } from "rxjs/operators"

export const connect = (input: {
  newTag$: Observable<{
    id: string
    label: string
  }>
  tagSubscription$: Observable<{
    id: string
    sid: string
  }>
  tagUnsubscription$: Observable<{
    id: string
    sid: string
  }>
  tagValueChange$: Observable<{
    id: string
    sid: string
    value: any
  }>
  tagRefDetection$: Observable<{
    id: string
    ref: string
  }>
}) => {
  const {
    newTag$,
    tagSubscription$,
    tagUnsubscription$,
    tagValueChange$,
    tagRefDetection$,
  } = input
  const distinctTagRefDetection$ = tagRefDetection$.pipe(
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
  )

  const stateAction$ = mergeWithKey({
    newTag$,
    tagRefDetection$: distinctTagRefDetection$,
  })

  const tag$ = stateAction$.pipe(
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
  )

  const action$ = mergeWithKey({
    tagSubscription$,
    tagUnsubscription$,
    tagValueChange$,
  })

  return {
    tag$,
    action$,
  }
}

type ObservableValue<T extends Observable<any>> = T extends Observable<infer R>
  ? R
  : never

export type Action = ObservableValue<ReturnType<typeof connect>["action$"]>

export type TagState = ObservableValue<ReturnType<typeof connect>["tag$"]>
