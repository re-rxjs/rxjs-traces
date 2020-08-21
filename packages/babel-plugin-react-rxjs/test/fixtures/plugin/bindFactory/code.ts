import { bind } from "@react-rxjs/core"

const [useCount, count$] = bind((id) =>
  source$.pipe(
    scan((value) => value + id, 0),
    startWith(0),
  ),
)

const [, delayedCount$] = bind(function (id) {
  return count$.pipe(delay(100))
})
