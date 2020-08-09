import { Observable, EMPTY, from, concat, of } from "rxjs"
import { startWith, pairwise, concatMap, map } from "rxjs/operators"

type Incremental<T> =
  | {
      type: "reset"
    }
  | {
      type: "incremental"
      payload: T
    }

const empty = Symbol("empty")
export const incremental = () => <T>(
  source: Observable<T[]>,
): Observable<Incremental<T>> =>
  source.pipe(
    startWith(empty),
    pairwise(),
    concatMap(([previous, next]) => {
      if (!Array.isArray(next)) {
        return EMPTY
      }
      const mapIncremental = map((v: T) => ({
        type: "incremental" as const,
        payload: v,
      }))
      if (previous === empty) {
        return from(next).pipe(mapIncremental)
      }
      if (next.length < previous.length) {
        return concat(
          of({
            type: "reset" as const,
          }),
          from(next).pipe(mapIncremental),
        )
      }
      return from(next.slice(previous.length)).pipe(mapIncremental)
    }),
  )

export const skipResetBursts = () => <T>(source: Observable<Incremental<T>>) =>
  new Observable<T>((obs) => {
    let bursting = false
    let lastBurstValue: any = empty
    return source.subscribe(
      (v) => {
        if (v.type === "reset") {
          lastBurstValue = empty
          bursting = true
          queueMicrotask(() => {
            bursting = false
            if (lastBurstValue !== empty) {
              obs.next(lastBurstValue)
            }
          })
        } else if (!bursting) {
          obs.next(v.payload)
        } else {
          lastBurstValue = v.payload
        }
      },
      obs.error.bind(obs),
      obs.complete.bind(obs),
    )
  })
