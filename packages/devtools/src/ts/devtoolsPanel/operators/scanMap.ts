import { Observable } from "rxjs"
import { scan, map, filter } from "rxjs/operators"

const nil = Symbol("nil")
const scanMapOperator = <S, T, R>(
  fn: (state: S, value: T) => [S, R | typeof nil],
  initialState: S,
) => (source: Observable<T>) =>
  source.pipe(
    scan(([state], value) => fn(state, value), [initialState, nil] as [
      S,
      R | typeof nil,
    ]),
    map(([, next]) => next as R),
    filter((v: any) => v !== nil),
  )

export const scanMap = Object.assign(scanMapOperator, { nil })
