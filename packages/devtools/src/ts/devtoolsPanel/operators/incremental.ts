import { Observable, EMPTY, from, concat, of } from "rxjs"
import { startWith, pairwise, concatMap, map } from "rxjs/operators"

const empty = Symbol("empty")
export const incremental = () => <T>(source: Observable<T[]>) =>
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
