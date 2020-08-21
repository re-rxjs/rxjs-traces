import * as autoRxjsTraces from "rxjs-traces"
import { bind } from "@react-rxjs/core"
const [useCount, count$] = bind((id) =>
  autoRxjsTraces.addDebugTag(
    "count$",
    "count$",
  )(
    source$.pipe(
      scan((value) => value + id, 0),
      startWith(0),
    ),
  ),
)
const [, delayedCount$] = bind(function (id) {
  return autoRxjsTraces.addDebugTag(
    "delayedCount$",
    "delayedCount$",
  )(
    (() => {
      return count$.pipe(delay(100))
    })(),
  )
})
