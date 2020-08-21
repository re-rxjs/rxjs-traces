import * as autoRxjsTraces from "rxjs-traces"
import { bind } from "@react-rxjs/core"
const [useCount, count$] = bind(
  autoRxjsTraces.addDebugTag(
    "count$",
    "count$",
  )(
    source$.pipe(
      scan((value) => value + 1, 0),
      startWith(0),
    ),
  ),
)
