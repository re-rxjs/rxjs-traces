import * as autoRxjsTraces from "babel-plugin-react-rxjs"
import { bind } from "@react-rxjs/core"
const [useCount, count$] = bind(
  autoRxjsTraces.wrapReactRxjs(
    (id) =>
      source$.pipe(
        scan((value) => value + id, 0),
        startWith(0),
      ),
    "count$",
  ),
)
const [, delayedCount$] = bind(
  autoRxjsTraces.wrapReactRxjs(function (id) {
    return count$(id).pipe(delay(100))
  }, "delayedCount$"),
)

function sum(id) {
  return count$(id).pipe(scan((a, b) => a + b, 0))
}

const [, countSum$] = bind(autoRxjsTraces.wrapReactRxjs(sum, "countSum$"))
