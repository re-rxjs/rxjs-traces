import { bind } from "@react-rxjs/core"

const [useCount, count$] = bind((id) =>
  source$.pipe(
    scan((value) => value + id, 0),
    startWith(0),
  ),
)

const [, delayedCount$] = bind(function (id) {
  return count$(id).pipe(delay(100))
})

function sum(id) {
  return count$(id).pipe(scan((a, b) => a + b, 0))
}
const [, countSum$] = bind(sum)
